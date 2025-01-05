import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';

import { initializeApp } from '@angular/fire/app';
import { firebaseConfig } from '../../../environment';
import {
  Ingredient,
  IngredientAdjustment,
  Order,
  productInfo,
} from '../models/order.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private router = inject(Router);
  private firestore: Firestore;
  private db: any;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    this.firestore = getFirestore(app);
  }

  async getIngredientsData(): Promise<Ingredient[]> {
    const querySnapshot = await getDocs(
      collection(this.firestore, 'ingredientRestrictions')
    );
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return data as Ingredient[];
  }

  async getProductSizesAndPrices(): Promise<productInfo[]> {
    const querySnapshot = await getDocs(
      collection(this.firestore, 'productSizes')
    );

    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return data as productInfo[];
  }

  async getIngredientAdjustmentsData(): Promise<IngredientAdjustment[]> {
    const querySnapshot = await getDocs(
      collection(this.firestore, 'ingredientAdjustments')
    );
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return data as IngredientAdjustment[];
  }

  async createNewGroup(creatorId: string) {
    const today = new Date();
    const formattedDate = `${
      today.getMonth() + 1
    }-${today.getDate()}-${today.getFullYear()}`;

    const docRef = doc(this.db, 'orders', formattedDate);

    try {
      const docSnapshot = await getDoc(docRef);

      if (docSnapshot.exists()) {
        if (docSnapshot.data()[creatorId]) {
          alert(
            'You already have a group today and cannot create another. But you can still order from other groups.'
          );
          return;
        }
        await updateDoc(docRef, {
          [creatorId]: [],
        });
      } else {
        await setDoc(docRef, {
          [creatorId]: [],
        });
      }

      this.router.navigate(['order/' + creatorId]);
    } catch (error) {
      console.error('Error creating new group:', error);
    }
  }

  async submitOrder(order: Order, creatorId: string) {
    const today = new Date();
    const formattedDate = `${
      today.getMonth() + 1
    }-${today.getDate()}-${today.getFullYear()}`;

    const docRef = doc(this.db, 'orders', formattedDate);

    try {
      const docSnapshot = await getDoc(docRef);

      if (docSnapshot.exists()) {
        await updateDoc(docRef, {
          [creatorId]: arrayUnion(order),
        });
      } else {
        await setDoc(docRef, {
          [creatorId]: [order],
        });
      }
      console.log('Order submitted successfully');

      // this.router.navigate([`order/${creatorId}/summary`]);
      this.router.navigateByUrl(`order/${creatorId}/summary`);
    } catch (error) {
      console.error('Error submitting order:', error);
    }
  }

  async retrieveOrdersPerUser(date: string, creatorId: string) {
    const docRef = doc(this.db, 'orders', date);

    try {
      const docSnapshot = await getDoc(docRef);

      if (docSnapshot.exists()) {
        const data = docSnapshot.data();

        return data[creatorId] as Order[];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error retrieving orders:', error);
      throw error;
    }
  }

  async retrieveOrders(date: string) {
    const docRef = doc(this.db, 'orders', date);

    try {
      const docSnapshot = await getDoc(docRef);

      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        return data as {
          [key: string]: Order[];
        };
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error retrieving orders:', error);
      throw error;
    }
  }
}
