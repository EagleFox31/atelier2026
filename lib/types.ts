export type WorkshopStatus = 
  | 'RECEIVED' 
  | 'DIAGNOSTIC' 
  | 'IN_PROGRESS' 
  | 'WAITING_PARTS' 
  | 'READY' 
  | 'INVOICED' 
  | 'CANCELLED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  vin: string;
  mileage: number;
  customerId: string;
  customerName: string;
  lastVisit?: string;
}

export interface LaborEntry {
  id: string;
  description: string;
  hours: number;
  rate: number;
}

export interface PartEntry {
  id: string;
  partId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  vehicleId: string;
  vehicleName: string;
  plate: string;
  customerId: string;
  customerName: string;
  status: WorkshopStatus;
  priority: Priority;
  description: string;
  diagnostic?: string;
  createdAt: string;
  updatedAt: string;
  estimatedTime?: string;
  technicianId?: string;
  technicianName?: string;
  parts: PartEntry[];
  labor: LaborEntry[];
  totalAmount?: number;
}

export interface Part {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  minThreshold: number;
  price: number;
  location?: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  customerName: string;
  vehicleName: string;
  date: string;
  time: string;
  type: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
}

export interface Technician {
  id: string;
  name: string;
  specialty: string;
  status: 'AVAILABLE' | 'BUSY' | 'AWAY';
  avatar?: string;
  currentOrderId?: string;
  efficiency: number; // 0-100
  completedJobs: number;
}

export interface TeamActivity {
  id: string;
  technicianId: string;
  technicianName: string;
  action: string;
  orderId?: string;
  timestamp: string;
}

export interface Quote {
  id: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleName: string;
  plate: string;
  vin: string;
  mileage: number;
  items: (PartEntry | LaborEntry)[];
  subtotal: number;
  tax: number;
  total: number;
  validUntil: string;
  createdAt: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
}

export interface Invoice {
  id: string;
  quoteId?: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleName: string;
  plate: string;
  items: (PartEntry | LaborEntry)[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  paymentMethod?: string;
  createdAt: string;
  paidAt?: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
}

export interface StockMovement {
  id: string;
  partId: string;
  partName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  orderId?: string;
  technicianId?: string;
  technicianName?: string;
  timestamp: string;
}
