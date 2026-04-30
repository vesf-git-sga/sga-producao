import React, { useState } from 'react';
import { X, Upload, CheckCircle, FileText } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../App'; // Ajuste o import conforme sua estrutura

interface FinalizeSubstitutionModalProps {
  substitution: any; // O objeto da pendência
  onClose: () => void;
  onSuccess: () => void;
  API_URL: string;
}

const FinalizeSubstitutionModal = ({ substitution, onClose, onSuccess, API_URL }: FinalizeSubstitutionModalProps) => {
  const { addToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnCondition, setReturnCondition] = useState('defective');

  const handleConfirm = async () => {
    if (!file) return addToast('Anexe o termo assinado.', 'error');
    
    setLoading(true);
    const formData = new FormData();
    formData.append('receiptFile', file);
    formData.append('return_condition', returnCondition);

    try {
      await axios.post(`${API_URL}/substitutions/${substitution.id}/finalize`, formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast('Substituição finalizada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao finalizar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1005] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6"/></button>
        
        <h2 className="text-xl font-bold text-blue-900 mb-4">Finalizar Substituição</h2>
        
        <div className="bg-blue-50 p-3 rounded mb-4 text-sm text-blue-800">
            <p><strong>Responsável:</strong> {substitution.recipient_name}</p>
            <p><strong>Entregue:</strong> {substitution.new_model} ({substitution.new_pat})</p>
            <p><strong>Recolhido:</strong> {substitution.old_model} ({substitution.old_pat})</p>
        </div>

        <div className="space-y-4">
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Condição do Item Recolhido</label>
                 <select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)} className="w-full p-2 border rounded">
                    <option value="defective">Com Defeito (Manutenção)</option>
                    <option value="good">Bom Estado (Estoque)</option>
                 </select>
            </div>

            <div className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer ${file ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <input type="file" id="finalFile" className="hidden" accept=".pdf,.jpg,.png" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} />
                <label htmlFor="finalFile" className="cursor-pointer flex flex-col items-center">
                    {file ? <FileText className="w-8 h-8 text-green-600"/> : <Upload className="w-8 h-8 text-gray-400"/>}
                    <span className="text-sm mt-2">{file ? file.name : "Clique para anexar o termo assinado"}</span>
                </label>
            </div>

            <button onClick={handleConfirm} disabled={loading} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Processando...' : 'Confirmar e Finalizar'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default FinalizeSubstitutionModal;