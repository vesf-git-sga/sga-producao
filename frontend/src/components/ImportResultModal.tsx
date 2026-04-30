// frontend/src/components/ImportResultModal.tsx

import React from 'react';
import { X, CheckCircle, AlertTriangle as AlertTriangleIcon } from 'lucide-react';

interface ImportResultModalProps {
  result: {
    importedCount: number;
    errors: string[];
  };
  onClose: () => void;
}

const ImportResultModal = ({ result, onClose }: ImportResultModalProps) => {
  const { importedCount, errors } = result;
  const errorCount = errors.length;
  const totalProcessed = importedCount + errorCount;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-4">Resultado da Importação</h2>
        
        <div className="mb-6 text-center border-b pb-4">
            <p className="text-lg text-gray-700">
                Processamento concluído: 
                <span className="font-bold text-green-600"> {importedCount} sucesso(s)</span> e 
                <span className="font-bold text-red-600"> {errorCount} erro(s)</span>.
            </p>
        </div>

        {errorCount > 0 && (
          <div className="flex-grow overflow-y-auto pr-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
              <AlertTriangleIcon className="w-5 h-5 mr-2 text-red-500" />
              Detalhes dos Erros
            </h3>
            <ul className="space-y-2 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
              {errors.map((error, index) => (
                <li key={index} className="text-red-800">
                  - {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {errorCount === 0 && (
            <div className="text-center py-10">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg text-gray-700">Todos os registros foram importados com sucesso!</p>
            </div>
        )}

        <div className="flex justify-end space-x-3 mt-8 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportResultModal;