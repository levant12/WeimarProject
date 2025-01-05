import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { FirestoreUser } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-all-orders',
  standalone: true,
  imports: [],
  templateUrl: './all-orders.component.html',
  styleUrl: './all-orders.component.scss',
  providers: [],
})
export class AllOrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private userService = inject(UsersService);
  private router = inject(Router);
  orderCreators: FirestoreUser[] = [];
  orderCreatorsIds: string[] | undefined;

  constructor() {}

  clickOrderGroup(orderCreator: FirestoreUser) {
    localStorage.setItem('orderCreator', JSON.stringify(orderCreator));
    this.router.navigate(['order/' + orderCreator.id]);
  }

  createNewGroup() {
    return this.authService
      .getCurrentUser()
      .pipe(
        switchMap((val) => {
          if (!val) return of(null);
          return this.orderService.createNewGroup(val.uid);
        })
      )
      .subscribe();
  }

  async getCreators(date: Date | undefined) {
    if (!date) return;

    const formattedDate = `${
      date.getMonth() + 1
    }-${date.getDate()}-${date.getFullYear()}`;
    try {
      const orders = await this.orderService.retrieveOrders(formattedDate);

      if (!orders) return;

      this.orderCreatorsIds = Object.keys(orders);

      const creatorPromises = this.orderCreatorsIds.map((id) =>
        this.userService.getUserWithId(id)
      );
      const creators = await Promise.all(creatorPromises);

      this.orderCreators = creators.filter(
        (creator) => creator !== undefined || creator !== null
      ) as FirestoreUser[];
    } catch (error) {
      console.error('Error retrieving creators:', error);
    }
  }

  ngOnInit() {
    this.getCreators(new Date());
  }
}
