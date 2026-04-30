// frontend/src/components/RequestRetirementModal.tsx

import React, { useState } from 'react';
import { X, Save, UploadCloud } from 'lucide-react';
import { Asset } from '../App';

interface RequestRetirementModalProps {
  asset: Asset;
  onClose: () => void;
  onSubmit: (assetId: number, formData: FormData) => Promise<void>;
}

const RequestRetirementModal = ({ asset, onClose, onSubmit }: RequestRetirementModalProps) => {
  // Campos existentes
  const [reason, setReason] = useState(''); // Justificativa/Detalhes
  const [details, setDetails] = useState(''); // Detalhes extras
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  
  // NOVOS CAMPOS
  const [type, setType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEvidenceFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!type || !reason || !evidenceFile || !eventDate) {
      setError('Preencha todos os campos obrigatórios e anexe a evidência.');
      return;
    }
    
    if ((type === 'Furto/Roubo' || type === 'Extravio') && !documentNumber) {
        setError('Para Furto ou Extravio, o número do B.O./Documento é obrigatório.');
        return;
    }

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    // Campos antigos (mantidos para compatibilidade)
    formData.append('reason', reason); // A "Justificativa" vira o reason principal
    formData.append('details', details);
    formData.append('evidenceFile', evidenceFile);

    // Campos Novos
    formData.append('retirement_type', type);
    formData.append('document_number', documentNumber);
    formData.append('event_date', eventDate);
    
    await onSubmit(asset.id, formData);
    
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Solicitar Baixa de Ativo</h2>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 border rounded-md text-sm">
              <p><strong>Ativo:</strong> {asset.brand} {asset.model}</p>
              <p><strong>Patrimônio:</strong> {asset.patrimonio_number || 'N/A'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Baixa *</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border rounded-md text-sm" required>
                    <option value="">Selecione...</option>
                    <option value="Obsolescência">Obsolescência</option>
                    <option value="Dano Irreparável">Dano Irreparável</option>
                    <option value="Furto/Roubo">Furto / Roubo</option>
                    <option value="Extravio">Extravio</option>
                    <option value="Doação">Doação / Transferência</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Fato *</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full p-2 border rounded-md text-sm" required />
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº Documento (B.O. / Laudo / SEI)
                {(type === 'Furto/Roubo' || type === 'Extravio') && <span className="text-red-500">*</span>}
            </label>
            <input 
                type="text" 
                value={documentNumber} 
                onChange={e => setDocumentNumber(e.target.value)} 
                className="w-full p-2 border rounded-md text-sm" 
                placeholder="Ex: B.O. 1234/2026"
            />
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Justificativa / Motivo *</label>
            <textarea id="reason" rows={2} value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: Equipamento queimado após queda de raio..." required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anexar Evidência (Laudo, B.O.) *</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:bg-gray-50 transition-colors">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                    <span>Carregar arquivo</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" required />
                  </label>
                </div>
                {evidenceFile ? (<p className="text-sm text-green-600 font-semibold">{evidenceFile.name}</p>) : (<p className="text-xs text-gray-500">PDF, PNG, JPG</p>)}
              </div>
            </div>
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex justify-end space-x-3 mt-8 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50 flex items-center">
            <Save className="w-5 h-5 mr-2"/>
            {isLoading ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequestRetirementModal;