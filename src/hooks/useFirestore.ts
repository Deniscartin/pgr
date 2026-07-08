import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Trip, User, InvoiceData, PriceCheck } from '@/lib/types';

// Numero massimo di documenti caricati di default dalle liste in tempo reale.
// Evita di scaricare intere collezioni all'avvio: il caricamento iniziale
// resta veloce anche quando il database cresce. Le viste caricano i piu recenti.
export const DEFAULT_QUERY_LIMIT = 500;

// Hook per gestire gli ordini
export function useOrders(maxResults: number = DEFAULT_QUERY_LIMIT) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(maxResults));
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
  }, [maxResults]);

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

// Azioni di scrittura sugli ordini senza sottoscrivere l'intera collezione.
// Da usare quando serve solo creare/aggiornare/eliminare (es. dashboard autista,
// modali) evitando di scaricare tutti gli ordini all'avvio.
export function useOrderActions() {
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

  return { addOrder, updateOrder, deleteOrder };
}

// Carica solo gli ordini indicati dagli id forniti (fetch mirato, non un listener
// sull'intera collezione). Utile per risolvere trip.orderId -> order quando i
// viaggi sono gia filtrati (es. quelli di un singolo autista).
export function useOrdersByIds(orderIds: string[]) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Chiave stabile e deduplicata: evita ri-fetch se cambia solo l'ordine/duplicati.
  const key = Array.from(new Set(orderIds.filter(Boolean))).sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];

    if (ids.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      ids.map(async (id) => {
        const snap = await getDoc(doc(db, 'orders', id));
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
          id: snap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Order;
      })
    ).then((results) => {
      if (cancelled) return;
      setOrders(results.filter((o): o is Order => o !== null));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { orders, loading };
}

// Hook per gestire i viaggi
export function useTrips(driverId?: string, maxResults: number = DEFAULT_QUERY_LIMIT) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, 'trips'), orderBy('createdAt', 'desc'), limit(maxResults));

    if (driverId) {
      q = query(collection(db, 'trips'), where('driverId', '==', driverId), orderBy('createdAt', 'desc'), limit(maxResults));
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
  }, [driverId, maxResults]);

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

// Hook per ottenere tutti i vettori univoci dal database
export function useCarriers() {
  const [carriers, setCarriers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carica tutti gli utenti (autisti e operatori) e estrae i carrier univoci
    const q = query(collection(db, 'users'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allCarriers = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const userData = doc.data();
        
        // Estrai carriers dall'array carriers
        if (userData.carriers && Array.isArray(userData.carriers)) {
          userData.carriers.forEach((carrier: string) => {
            if (carrier && carrier.trim()) {
              allCarriers.add(carrier.trim());
            }
          });
        }
        
        // Estrai anche dal campo carrier singolo (retrocompatibilità)
        if (userData.carrier && typeof userData.carrier === 'string') {
          const carrierValue = userData.carrier.trim();
          if (carrierValue) {
            allCarriers.add(carrierValue);
          }
        }
      });
      
      // Converte il Set in array e ordina alfabeticamente
      const sortedCarriers = Array.from(allCarriers).sort();
      setCarriers(sortedCarriers);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { carriers, loading };
} 