'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Plus, Trash2, Save } from 'lucide-react';
import { collection, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LoadingBase {
  code: string;
  name: string;
  fullName?: string;
}

interface LoadingBasesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoadingBasesModal({ isOpen, onClose }: LoadingBasesModalProps) {
  const [bases, setBases] = useState<LoadingBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBaseCode, setNewBaseCode] = useState('');
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseFullName, setNewBaseFullName] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchBases();
    }
  }, [isOpen]);

  const fetchBases = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'settings', 'loadingBases');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBases(data.bases || []);
      } else {
        // Initialize with default bases
        const defaultBases = [
          { code: 'LT', name: 'Latina', fullName: '' },
          { code: 'RM', name: 'Roma', fullName: '' },
          { code: 'CH', name: 'Chieti', fullName: '' },
          { code: 'LI', name: 'Livorno', fullName: '' },
          { code: 'FR', name: 'Frosinone', fullName: '' },
        ];
        await setDoc(docRef, { bases: defaultBases });
        setBases(defaultBases);
      }
    } catch (error) {
      console.error('Error fetching loading bases:', error);
      alert('Errore nel caricamento delle basi di carico');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBases = async () => {
    try {
      setSaving(true);
      const docRef = doc(db, 'settings', 'loadingBases');
      await setDoc(docRef, { bases });
      alert('✅ Basi di carico salvate con successo!');
      onClose();
    } catch (error) {
      console.error('Error saving loading bases:', error);
      alert('Errore nel salvataggio delle basi di carico');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBase = () => {
    if (!newBaseCode.trim() || !newBaseName.trim()) {
      alert('Inserisci codice e nome per la nuova base');
      return;
    }

    const code = newBaseCode.toUpperCase().trim();
    
    if (bases.some(b => b.code === code)) {
      alert('Codice già esistente');
      return;
    }

    setBases([...bases, { 
      code, 
      name: newBaseName.trim(),
      fullName: newBaseFullName.trim() 
    }]);
    setNewBaseCode('');
    setNewBaseName('');
    setNewBaseFullName('');
  };

  const handleDeleteBase = (code: string) => {
    if (confirm(`Eliminare la base ${code}?`)) {
      setBases(bases.filter(b => b.code !== code));
    }
  };

  const handleUpdateBase = (code: string, field: 'name' | 'fullName', value: string) => {
    setBases(bases.map(b => 
      b.code === code ? { ...b, [field]: value } : b
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <MapPin className="h-6 w-6 mr-2 text-indigo-600" />
              Gestisci Basi di Carico
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Aggiungi o modifica le basi di carico disponibili
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

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add New Base */}
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Aggiungi Nuova Base</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Codice (es: LT)"
                    value={newBaseCode}
                    onChange={(e) => setNewBaseCode(e.target.value.toUpperCase().slice(0, 2))}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    placeholder="Nome (es: Latina)"
                    value={newBaseName}
                    onChange={(e) => setNewBaseName(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Nome Completo (opzionale)"
                    value={newBaseFullName}
                    onChange={(e) => setNewBaseFullName(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={handleAddBase}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Aggiungi
                  </button>
                </div>
              </div>

              {/* Existing Bases */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Basi Esistenti</h3>
                {bases.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Nessuna base di carico configurata
                  </p>
                ) : (
                  bases.map((base) => (
                    <div key={base.code} className="flex items-center gap-3 p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <div className="w-16">
                        <div className="px-3 py-2 bg-indigo-100 text-indigo-800 font-bold text-center rounded">
                          {base.code}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={base.name}
                        onChange={(e) => handleUpdateBase(base.code, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Nome"
                      />
                      <input
                        type="text"
                        value={base.fullName || ''}
                        onChange={(e) => handleUpdateBase(base.code, 'fullName', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Nome Completo (opzionale)"
                      />
                      <button
                        onClick={() => handleDeleteBase(base.code)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end items-center gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSaveBases}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salva Modifiche
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

