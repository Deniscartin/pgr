'use client';

import { useState, useEffect } from 'react';
import { X, Folder, Image, Download, Search, RefreshCw, Server, HardDrive } from 'lucide-react';

interface ArchiveFile {
  name: string;
  is_dir: boolean;
  size: number | null;
}

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REMOTE_SERVER = 'http://192.168.77.34:8443';

export default function ArchiveModal({ isOpen, onClose }: ArchiveModalProps) {
  const [currentPath, setCurrentPath] = useState('E:\\Server\\documents');
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFiles(currentPath);
    }
  }, [isOpen, currentPath]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Usa il proxy API Next.js per bypassare CORS
      const response = await fetch(
        `/api/archive?action=list&path=${encodeURIComponent(path)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Errore ${response.status}`);
      }

      const data = await response.json();
      setFiles(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      console.error('Errore caricamento file:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath.endsWith('/') || currentPath.endsWith('\\')
      ? currentPath + folderName
      : currentPath + '\\' + folderName;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    const parts = currentPath.split(/[/\\]/);
    parts.pop();
    setCurrentPath(parts.join('\\') || 'E:\\Server\\documents');
  };

  const downloadFile = async (fileName: string) => {
    try {
      const filePath = currentPath.endsWith('/') || currentPath.endsWith('\\')
        ? currentPath + fileName
        : currentPath + '\\' + fileName;
      
      // Usa il proxy API
      const response = await fetch(
        `/api/archive?action=download&path=${encodeURIComponent(filePath)}`
      );

      if (!response.ok) {
        throw new Error('Errore durante il download');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Errore durante il download: ' + (err instanceof Error ? err.message : 'Errore sconosciuto'));
    }
  };

  const viewImage = (fileName: string) => {
    const filePath = currentPath.endsWith('/') || currentPath.endsWith('\\')
      ? currentPath + fileName
      : currentPath + '\\' + fileName;
    
    // Usa il proxy API per le immagini
    const imageUrl = `/api/archive?action=download&path=${encodeURIComponent(filePath)}`;
    setSelectedImage(imageUrl);
  };

  const formatSize = (bytes: number | null) => {
    if (bytes === null) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HardDrive className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Archivio Server Remoto</h3>
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Server className="w-4 h-4 mr-1" />
                {REMOTE_SERVER}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Path Navigation */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              onClick={navigateUp}
              disabled={currentPath === 'E:\\Server\\documents' || currentPath === 'E:\\Server'}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              ↑ Su
            </button>
            <button
              onClick={() => loadFiles(currentPath)}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Ricarica
            </button>
            <div className="flex-1 px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
              {currentPath}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca file..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Errore di connessione</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <button
                onClick={() => loadFiles(currentPath)}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Riprova
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Nessun file trovato</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map((file, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    file.is_dir ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {file.is_dir ? (
                        <Folder className="w-8 h-8 text-blue-600" />
                      ) : isImageFile(file.name) ? (
                        <Image className="w-8 h-8 text-green-600" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-600">
                          {file.name.split('.').pop()?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      {!file.is_dir && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatSize(file.size)}
                        </p>
                      )}
                      <div className="mt-2 flex space-x-2">
                        {file.is_dir ? (
                          <button
                            onClick={() => navigateToFolder(file.name)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Apri
                          </button>
                        ) : (
                          <>
                            {isImageFile(file.name) && (
                              <button
                                onClick={() => viewImage(file.name)}
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Visualizza
                              </button>
                            )}
                            <button
                              onClick={() => downloadFile(file.name)}
                              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{filteredFiles.length} elementi</span>
            <span>{filteredFiles.filter(f => !f.is_dir).length} file • {filteredFiles.filter(f => f.is_dir).length} cartelle</span>
          </div>
        </div>
      </div>

      {/* Image Viewer */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

