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
import { Order, Trip, User, InvoiceData, PriceCheck } from '@/lib/types';

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

  const deleteTrip = async (id: string) => {
    await deleteDoc(doc(db, 'trips', id));
  };

  return { trips, loading, addTrip, updateTrip, completeTrip, deleteTrip };
}

// Hook per gestire gli utenti autisti
export function useDrivers(carrier?: string) {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se non c'è carrier specificato, restituisce tutti gli autisti (per admin)
    // Se c'è carrier specificato, filtra solo per quel carrier
    if (carrier) {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'autista'), 
        where('carriers', 'array-contains', carrier)
      );

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
    } else {
      // Per admin - mostra tutti gli autisti
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
    }
  }, [carrier]);

  return { drivers, loading };
}

// Hook per gestire le fatture
export function useInvoices(invoiceType?: 'attivo' | 'passivo') {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    
    if (invoiceType) {
      q = query(collection(db, 'invoices'), where('invoiceType', '==', invoiceType), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as InvoiceData[];
      setInvoices(invoicesData);
      setLoading(false);
    });

    return unsubscribe;
  }, [invoiceType]);

  const addInvoice = async (invoiceData: Omit<InvoiceData, 'id' | 'createdAt' | 'updatedAt'>) => {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { id: docRef.id };
  };

  const updateInvoice = async (id: string, invoiceData: Partial<InvoiceData>) => {
    await updateDoc(doc(db, 'invoices', id), {
      ...invoiceData,
      updatedAt: Timestamp.now(),
    });
  };

  const deleteInvoice = async (id: string) => {
    await deleteDoc(doc(db, 'invoices', id));
  };

  return { invoices, loading, addInvoice, updateInvoice, deleteInvoice };
}

// Hook per gestire gli utenti gestore fatture  
export function useInvoiceManagers() {
  const [invoiceManagers, setInvoiceManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'gestore_fatture'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const managersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as User[];
      setInvoiceManagers(managersData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { invoiceManagers, loading };
}

// Hook per gestire i controlli prezzi
export function usePriceChecks() {
  const [priceChecks, setPriceChecks] = useState<PriceCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'priceChecks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const priceChecksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as PriceCheck[];
      setPriceChecks(priceChecksData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const addPriceCheck = async (priceCheckData: Omit<PriceCheck, 'id' | 'createdAt'>) => {
    const docRef = await addDoc(collection(db, 'priceChecks'), {
      ...priceCheckData,
      createdAt: Timestamp.now(),
    });
    return { id: docRef.id };
  };

  const deletePriceCheck = async (id: string) => {
    await deleteDoc(doc(db, 'priceChecks', id));
  };

  return { priceChecks, loading, addPriceCheck, deletePriceCheck };
} 