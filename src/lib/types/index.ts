export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'autista' | 'operatore';
  qrCode?: string; // QR code associato al driver (solo per autisti)
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  product: string;
  customerName: string;
  customerCode: string;
  deliveryAddress: string;
  destinationCode: string;
  quantity: number;
  quantityUnit: string;
  status: 'pendente' | 'assegnato' | 'completato' | 'annullato';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  // Optional fields from PDF parsing
  carrierInfo?: any;
  loadingInfo?: any;
  driverInfo?: any;
  bdcNumber?: string;
  identifier?: string;
}

export type OrderStatus = 'pendente' | 'assegnato' | 'completato' | 'annullato';

export interface Trip {
  id: string;
  orderId: string;
  driverId: string;
  driverName: string;
  status: 'assegnato' | 'in_corso' | 'completato' | 'annullato' | 'elaborazione';
  assignedBy: string;
  dasCode?: string;
  signatureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  edasData?: ParsedEDASData;
  loadingNoteData?: ParsedLoadingNoteData;
  validationResults?: ValidationResult[];
  // Image storage URLs
  edasImageUrl?: string;
  edasProcessedImageUrl?: string;
  loadingNoteImageUrl?: string;
  loadingNoteProcessedImageUrl?: string;
  cartelloCounterImageUrl?: string;
}

export interface ValidationResult {
  field: string;
  edasValue: string | number;
  loadingNoteValue: string | number;
  isMatch: boolean;
  severity: 'error' | 'warning' | 'info';
}

export interface Invoice {
  id: string;
  tripId: string;
  invoiceNumber: string;
  amount: number;
  signatureUrl: string;
  createdAt: Date;
}

export interface ParsedPDFOrder {
  orderNumber: string;
  product: string;
  customerName: string;
  customerCode: string;
  deliveryAddress: string;
  destinationCode: string;
  quantity: number;
  quantityUnit: string;
  identifier: string;
}

export interface ParsedPDFData {
  carrierInfo: {
    vettore: string;
    partitaIva: string;
    address: string;
  };
  loadingInfo: {
    dataCarico: string;
    luogoCarico: string;
    stato: string;
  };
  driverInfo: {
    autista: string;
    codiceAutista?: string;
    targaMotrice?: string;
    targaRimorchio?: string;
    tankContainer?: string;
  };
  bdcNumber: string;
  orders: ParsedPDFOrder[];
}

export interface ParsedLoadingNoteData {
  documentNumber: string;
  loadingDate: string;
  carrierName: string;
  shipperName: string;
  consigneeName: string;
  productDescription: string;
  grossWeightKg: number;
  netWeightKg: number;
  volumeLiters: number;
  notes: string;
}

export interface ParsedEDASData {
  documentInfo: {
    dasNumber: string;
    version: string;
    localReferenceNumber: string;
    invoiceNumber: string;
    invoiceDate: string;
    registrationDateTime: string;
    shippingDateTime: string;
    validityExpirationDateTime: string;
  };
  senderInfo: {
    depositoMittenteCode: string;
    name: string;
    address: string;
  };
  depositorInfo: {
    name: string;
    id: string;
  };
  recipientInfo: {
    name: string;
    address: string;
    taxCode: string;
  };
  transportInfo: {
    transportManager: string;
    transportMode: string;
    vehicleType: string;
    vehicleId: string;
    estimatedDuration: string;
    firstCarrierName: string;
    firstCarrierId: string;
    driverName: string;
  };
  productInfo: {
    productCode: string;
    description: string;
    unCode: string;
    netWeightKg: number;
    volumeAtAmbientTempL: number;
    volumeAt15CL: number;
    densityAtAmbientTemp: number;
    densityAt15C: number;
  };
}

export type UserRole = 'admin' | 'autista' | 'operatore';
export type TripStatus = 'assegnato' | 'in_corso' | 'completato' | 'annullato' | 'elaborazione'; 