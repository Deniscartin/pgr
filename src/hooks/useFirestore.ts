import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  deleteDoc,
  documentId,
  getDocs,
  limit,
  startAfter,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Trip, User, InvoiceData, PriceCheck } from '@/lib/types';

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Restituisce l'inizio della giornata corrente e si aggiorna da solo a mezzanotte:
// l'autista può lasciare l'app aperta tutta la notte e il giorno dopo deve vedere
// la sua nuova giornata, non quella precedente.
export function useTodayStart() {
  const [dayStart, setDayStart] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    const nextMidnight = new Date(dayStart);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    const timer = setTimeout(
      () => setDayStart(startOfDay(new Date())),
      Math.max(nextMidnight.getTime() - Date.now(), 0)
    );
    return () => clearTimeout(timer);
  }, [dayStart]);

  return dayStart;
}

const mapTrip = (doc: QueryDocumentSnapshot<DocumentData>) => ({
  id: doc.id,
  ...doc.data(),
  createdAt: doc.data().createdAt?.toDate() || new Date(),
  updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  completedAt: doc.data().completedAt?.toDate() || undefined,
}) as Trip;

// Hook per gestire gli ordini.
// `subscribe: false` per i componenti che usano solo addOrder/updateOrder e non
// devono scaricare l'intera collection.
export function useOrders(options?: { subscribe?: boolean }) {
  const subscribe = options?.subscribe ?? true;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(subscribe);

  useEffect(() => {
    if (!subscribe) {
      setOrders([]);
      setLoading(false);
      return;
    }

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
  }, [subscribe]);

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

// Massimo numero di valori ammessi da Firestore in una clausola `in`
const IN_QUERY_LIMIT = 30;

// Hook per caricare solo gli ordini collegati ai viaggi visibili, invece
// dell'intera collection. Resta in realtime perché l'OCR compila l'ordine
// dopo la creazione del viaggio.
export function useOrdersByIds(orderIds: string[]) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Chiave stabile: l'effetto non deve ripartire ad ogni render solo perché
  // l'array arriva con una nuova identità.
  const idsKey = useMemo(
    () => Array.from(new Set(orderIds.filter(Boolean))).sort().join(','),
    [orderIds]
  );

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];

    if (ids.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_QUERY_LIMIT) {
      chunks.push(ids.slice(i, i + IN_QUERY_LIMIT));
    }

    const byChunk: Order[][] = chunks.map(() => []);
    const unsubscribes = chunks.map((chunk, index) =>
      onSnapshot(
        query(collection(db, 'orders'), where(documentId(), 'in', chunk)),
        (snapshot) => {
          byChunk[index] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          })) as Order[];
          setOrders(byChunk.flat());
          setLoading(false);
        }
      )
    );

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [idsKey]);

  return { orders, loading };
}

// Numero di giorni mostrati dalle dashboard admin e operatore prima di
// dover aprire l'archivio.
export const RECENT_DAYS = 90;

// Hook per gestire i viaggi.
// `todayOnly: true` limita la query ai viaggi creati dalla mezzanotte in poi
// (dashboard autista), `sinceDays: N` a quelli degli ultimi N giorni
// (dashboard admin e operatore). Senza nessuna delle due la query non ha
// limite di data e scarica l'intera collection.
export function useTrips(
  driverId?: string,
  options?: { todayOnly?: boolean; sinceDays?: number; requireDriverId?: boolean }
) {
  const todayOnly = options?.todayOnly ?? false;
  const sinceDays = options?.sinceDays;
  const requireDriverId = options?.requireDriverId ?? false;
  const dayStart = useTodayStart();

  // La soglia e' sempre ancorata a mezzanotte, non all'istante corrente: cosi'
  // cambia una volta al giorno e la query non viene ricreata a ogni render.
  const fromMs = useMemo(() => {
    if (todayOnly) return dayStart.getTime();
    if (sinceDays === undefined) return 0;
    const from = new Date(dayStart);
    from.setDate(from.getDate() - sinceDays);
    return from.getTime();
  }, [todayOnly, sinceDays, dayStart]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Chi è vincolato a un solo autista (la dashboard autista) non deve
    // interrogare nulla finché il profilo non è caricato: senza `driverId`
    // la query partirebbe senza filtro e mostrerebbe i viaggi di tutti.
    if (requireDriverId && !driverId) {
      setTrips([]);
      setLoading(true);
      return;
    }

    const constraints: QueryConstraint[] = [];

    if (driverId) {
      constraints.push(where('driverId', '==', driverId));
    }
    if (fromMs > 0) {
      constraints.push(where('createdAt', '>=', Timestamp.fromMillis(fromMs)));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'trips'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTrips(snapshot.docs.map(mapTrip));
      setLoading(false);
    });

    return unsubscribe;
  }, [driverId, fromMs, requireDriverId]);

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

const ARCHIVE_PAGE_SIZE = 50;

// Hook per l'archivio viaggi di admin e operatore: l'intera collection, senza
// limite di data, caricata solo all'apertura del modale (`enabled`), a pagine
// e senza listener realtime — sono dati storici, non devono restare in ascolto.
//
// `driverIds` restringe l'archivio agli autisti dell'operatore. Firestore
// ammette al massimo IN_QUERY_LIMIT valori in una clausola `in`: oltre quella
// soglia il filtro viene applicato lato client, quindi una pagina puo'
// contenere meno di ARCHIVE_PAGE_SIZE risultati visibili.
export function useArchivedTrips(enabled: boolean, driverIds?: string[]) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Chiave stabile: l'effetto non deve ripartire a ogni render solo perche'
  // l'array arriva con una nuova identita'.
  const idsKey = useMemo(
    () => (driverIds ? Array.from(new Set(driverIds.filter(Boolean))).sort().join(',') : ''),
    [driverIds]
  );

  const fetchPage = useCallback(async (append: boolean) => {
    const ids = idsKey ? idsKey.split(',') : [];
    const restricted = driverIds !== undefined;

    // L'operatore senza autisti non ha nulla da archiviare: senza questo
    // controllo la query partirebbe senza filtro, mostrando i viaggi di tutti.
    if (restricted && ids.length === 0) {
      setTrips([]);
      setHasMore(false);
      return;
    }

    const serverSideFilter = ids.length > 0 && ids.length <= IN_QUERY_LIMIT;

    setLoading(true);
    try {
      const constraints: QueryConstraint[] = [];
      if (serverSideFilter) {
        constraints.push(where('driverId', 'in', ids));
      }
      constraints.push(orderBy('createdAt', 'desc'));

      if (append && cursorRef.current) {
        constraints.push(startAfter(cursorRef.current));
      }
      constraints.push(limit(ARCHIVE_PAGE_SIZE));

      const snapshot = await getDocs(query(collection(db, 'trips'), ...constraints));
      let page = snapshot.docs.map(mapTrip);
      if (restricted && !serverSideFilter) {
        page = page.filter(trip => trip.driverId && ids.includes(trip.driverId));
      }

      cursorRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
      setHasMore(snapshot.docs.length === ARCHIVE_PAGE_SIZE);
      setTrips(prev => (append ? [...prev, ...page] : page));
    } catch (error) {
      console.error('Error loading archived trips:', error);
    } finally {
      setLoading(false);
    }
  }, [idsKey, driverIds]);

  useEffect(() => {
    if (!enabled) return;

    // Riapertura dell'archivio: si riparte sempre dalla prima pagina, cosi' i
    // dati sono freschi anche senza listener.
    cursorRef.current = null;
    setTrips([]);
    setHasMore(false);
    fetchPage(false);
  }, [enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    fetchPage(true);
  }, [loading, hasMore, fetchPage]);

  return { trips, loading, hasMore, loadMore };
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