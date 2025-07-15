import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Trip, User } from '@/lib/types';

// Hook per gestire gli ordini
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const addOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
    const docRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { id: docRef.id };
  };

  const updateOrder = async (id: string, orderData: Partial<Order>) => {
    await updateDoc(doc(db, 'orders', id), {
      ...orderData,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteOrder = async (id: string) => {
    await deleteDoc(doc(db, 'orders', id));
  };

  return { orders, loading, addOrder, updateOrder, deleteOrder };
}

// Hook per gestire i viaggi
export function useTrips(driverId?: string) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, 'trips'), orderBy('createdAt', 'desc'));
    
    if (driverId) {
      q = query(collection(db, 'trips'), where('driverId', '==', driverId), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        completedAt: doc.data().completedAt?.toDate() || undefined,
      })) as Trip[];
      setTrips(tripsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [driverId]);

  const addTrip = async (tripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>) => {
    const docRef = await addDoc(collection(db, 'trips'), {
      ...tripData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { id: docRef.id };
  };

  const updateTrip = async (id: string, tripData: Partial<Trip>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      ...tripData,
      updatedAt: Timestamp.now(),
    };

    if (tripData.completedAt) {
      updateData.completedAt = Timestamp.fromDate(tripData.completedAt);
    }

    await updateDoc(doc(db, 'trips', id), updateData);
  };

  const completeTrip = async (id: string, dasCode: string, signatureUrl: string) => {
    await updateDoc(doc(db, 'trips', id), {
      status: 'completato',
      dasCode,
      signatureUrl,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  };

  return { trips, loading, addTrip, updateTrip, completeTrip };
}

// Hook per gestire gli utenti autisti
export function useDrivers() {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'autista'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driversData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as User[];
      setDrivers(driversData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { drivers, loading };
} 