import { Component, inject, OnInit, signal } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { MultiSelectModule } from 'primeng/multiselect';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RadioButton } from 'primeng/radiobutton';
import { MultiselectOption, OrderForm } from '../../models/forms.model';
import {
  Ingredient,
  IngredientAdjustment,
  Order,
  productInfo,
} from '../../models/order.model';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { switchMap, tap } from 'rxjs';
import { Select } from 'primeng/select';
import { AuthService } from '../../services/auth.service';
import { Toast } from 'primeng/toast';
import { ToastrService } from 'ngx-toastr';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { PreviousOrderModalComponent } from '../../components/previous-order-modal/previous-order-modal.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.scss'],
  standalone: true,
  imports: [
    MultiSelectModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    RadioButton,
    TextareaModule,
    ButtonModule,
    Select,
    Toast,
  ],
  providers: [OrderService, ToastrService, DialogService],
})
export class OrderComponent implements OnInit {
  private orderService = inject(OrderService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private dialogService = inject(DialogService);
  private router = inject(Router);

  ref: DynamicDialogRef | undefined;

  previousOrder: Order | undefined;

  orderForm = signal<FormGroup<OrderForm>>(this.buildForm());

  ingredientOptions: MultiselectOption[] = [];
  productInfoOptions: MultiselectOption[] = [{ label: '', value: '' }];
  ingredientAdjustmentOptions: MultiselectOption[] = [];

  constructor() {}

  navigateToOrdersList() {
    this.router.navigate(['orders-summary']);
  }

  showPreviousOrder() {
    this.ref = this.dialogService.open(PreviousOrderModalComponent, {
      header: 'Your last order was: ',
      width: '70vw',
      modal: true,
      dismissableMask: true,
      focusOnShow: false,
      breakpoints: {
        '992px': '75vw',
        '576px': '90vw',
      },
      data: {
        previousOrder: this.previousOrder,
      },
    });
  }

  loadPreviousOrder() {
    const size = this.orderForm().get('size');
    const restrictions = this.orderForm().get('restrictions');
    const adjustments = this.orderForm().get('adjustments');
    const withEverything = this.orderForm().get('withEverything');

    const sizeOption = this.productInfoOptions.find(
      (option) => option.value === this.previousOrder?.productDetails.size
    );

    const transformRestrictionsToOptions =
      this.previousOrder?.productDetails?.restrictions?.map(
        (item) =>
          ({
            label: item,
            value: item,
          } as MultiselectOption)
      );

    const transformAdjustmentsToOptions =
      this.previousOrder?.productDetails?.adjustment?.map(
        (item) =>
          ({
            label: item,
            value: item,
          } as MultiselectOption)
      );

    size?.setValue(sizeOption);
    withEverything?.setValue(
      this.previousOrder?.productDetails?.withEverything
    );
    adjustments?.setValue(transformAdjustmentsToOptions);
    restrictions?.setValue(transformRestrictionsToOptions);
  }

  listenToWithEverythingControl() {
    this.orderForm()
      .controls.withEverything.valueChanges.pipe(
        tap((val) => {
          if (val) {
            this.orderForm().controls.restrictions.setValue([]);
          }
        })
      )
      .subscribe();
  }

  listenToRestrictions() {
    this.orderForm()
      .controls.restrictions.valueChanges.pipe(
        tap((val) => {
          if (val?.length) {
            this.orderForm().controls.withEverything.setValue(false);
          }
        })
      )
      .subscribe();
  }

  buildForm() {
    return this.fb.group<OrderForm>({
      size: this.fb.control(null),
      useLastOrder: this.fb.control(false),
      restrictions: this.fb.control([]),
      withEverything: this.fb.control(false),
      adjustments: this.fb.control([]),
    });
  }

  checkOverlappingProducts() {
    const restrictions = this.orderForm().get('restrictions')?.value;
    const adjustments = this.orderForm().get('adjustments')?.value;
    const restrictedProducts = restrictions?.map(
      (item) => item.label.split(' ')[1]
    );
    const adjustedProducts = adjustments?.map(
      (item) => item.label.split(' ')[1]
    );

    return restrictedProducts?.filter((value) =>
      adjustedProducts?.includes(value)
    );
  }

  checkFormValidity() {
    const size = this.orderForm().get('size')?.value;
    const restrictions = this.orderForm().get('restrictions')?.value;
    const withEverything = this.orderForm().get('withEverything')?.value;

    const overlappedProducts = this.checkOverlappingProducts();

    if (overlappedProducts?.length) {
      this.toastr.error(
        `Conflicting products in Restrictions and Adjustments: ${overlappedProducts.join(
          ', '
        )}`,
        'Error',
        {
          timeOut: 8000,
        }
      );
    }

    if (
      !!!size ||
      (!!!(restrictions && restrictions.length > 0) && !!!withEverything)
    ) {
      this.toastr.warning(
        'Please choose Size and Ingredients: either With Everything or Restrictions for your Shawarma :)',
        'Warning',
        {
          timeOut: 8000,
        }
      );
    }

    return (
      !!size &&
      (!!(restrictions && restrictions.length > 0) || !!withEverything) &&
      !!!overlappedProducts?.length
    );
  }

  checkPreviousOrder() {
    const previousOrder = localStorage.getItem('previousOrder');
    if (previousOrder) {
      this.previousOrder = JSON.parse(previousOrder);
    }
  }

  onIngredientAdjustment(event: any) {
    const selectedValue = event.itemValue;
    const formValue: MultiselectOption[] = event.value;
    const selectedProduct = selectedValue.value.split(' ')[1];
    const adjustmentsControl = this.orderForm().get('adjustments');

    if (formValue) {
      formValue.forEach((val, i) => {
        if (val.value.includes(selectedProduct) && val != selectedValue) {
          const newValue = formValue.filter(
            (formVal) => formVal.value !== val.value
          );
          adjustmentsControl?.setValue(newValue);
        }
      });
    }
  }

  submitOrder() {
    if (this.checkFormValidity()) {
      return this.authService
        .getCurrentUser()
        .pipe(
          switchMap((val) => {
            const payload: Order = {
              orderedBy: val?.displayName,
              photoUrl: val?.photoURL,
              productDetails: {
                price: this.orderForm().controls.size.value?.price,
                size: this.orderForm().controls.size.value?.value,
                restrictions: this.orderForm().controls.restrictions.value?.map(
                  (val) => val.value
                ),
                withEverything: this.orderForm().controls.withEverything.value,
                adjustment: this.orderForm().controls.adjustments.value?.map(
                  (val) => val.value
                ),
              },
            };
            localStorage.setItem('previousOrder', JSON.stringify(payload));

            return this.orderService.submitOrder(payload);
          })
        )
        .subscribe();
    } else {
      return;
    }
  }

  mapToMultiselectValues(ingredients: Ingredient[]) {
    ingredients.map((val) => {
      this.ingredientOptions.push({
        label: val.product.restriction,
        value: val.product.restriction,
      });
    });
  }

  mapProductsInfo(productsInfo: productInfo[]) {
    productsInfo.map((val) => {
      this.productInfoOptions.push({
        label: val.productInfo.size,
        value: val.productInfo.size,
        price: val.productInfo.price,
      });
    });
    this.productInfoOptions.splice(0, 1);
  }

  mapIngredientAdjustments(ingredientAdjustments: IngredientAdjustment[]) {
    ingredientAdjustments.forEach((val) => {
      if (val.product.adjustment && val.product.ingredient) {
        val.product.adjustment.forEach((adjustment: string) => {
          this.ingredientAdjustmentOptions.push({
            label: adjustment,
            value: adjustment,
          });
        });
      }
    });
  }

  getProductInfo() {
    this.orderService.getProductSizesAndPrices().then((val) => {
      this.mapProductsInfo(val);
    });
  }

  getIngredients() {
    this.orderService.getIngredientsData().then((val) => {
      this.mapToMultiselectValues(val);
    });
  }

  getIngredientAdjustments() {
    this.orderService.getIngredientAdjustmentsData().then((val) => {
      this.mapIngredientAdjustments(val);
    });
  }

  ngOnInit() {
    this.listenToWithEverythingControl();
    this.checkPreviousOrder();
    this.listenToRestrictions();
    this.getIngredients();
    this.getProductInfo();
    this.getIngredientAdjustments();
  }
}