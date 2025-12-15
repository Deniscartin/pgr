'use client';

import { X, UserPlus, Users, FileText } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDriver: () => void;
  onCreateOperator: () => void;
  onCreateInvoiceManager: () => void;
}

export default function UserManagementModal({ 
  isOpen, 
  onClose, 
  onCreateDriver, 
  onCreateOperator, 
  onCreateInvoiceManager 
}: UserManagementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 mr-2 text-indigo-600" />
              Gestione Utenti
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Seleziona il tipo di utente da creare
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Chiudi"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Create Driver */}
          <button
            onClick={() => {
              onClose();
              onCreateDriver();
            }}
            className="w-full flex items-center p-6 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
              <UserPlus className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-semibold text-gray-900">Crea Autista</h3>
              <p className="text-sm text-gray-600">
                Aggiungi un nuovo autista al sistema
              </p>
            </div>
          </button>

          {/* Create Operator */}
          <button
            onClick={() => {
              onClose();
              onCreateOperator();
            }}
            className="w-full flex items-center p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-600 transition-colors">
              <Users className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-semibold text-gray-900">Crea Operatore</h3>
              <p className="text-sm text-gray-600">
                Aggiungi un nuovo operatore al sistema
              </p>
            </div>
          </button>

          {/* Create Invoice Manager */}
          <button
            onClick={() => {
              onClose();
              onCreateInvoiceManager();
            }}
            className="w-full flex items-center p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-600 transition-colors">
              <FileText className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-semibold text-gray-900">Crea Gestore Fatture</h3>
              <p className="text-sm text-gray-600">
                Aggiungi un nuovo gestore fatture al sistema
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

