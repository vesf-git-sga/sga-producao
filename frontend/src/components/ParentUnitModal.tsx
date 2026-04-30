import React, { useState } from 'react';
import axios from 'axios';
import { X, Save } from 'lucide-react';
import { useToast } from '../App';

interface ParentUnitModalProps {
  onClose: () => void;
  onSaveSuccess: (newUnit: any) => void;
  API_URL: string;
}

const ParentUnitModal: React.FC<ParentUnitModalProps> = ({ onClose, onSaveSuccess, API_URL }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState(''); // NOVO ESTADO para a sigla
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      addToast('Nome e Sigla são obrigatórios.', 'error');
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const newUnitData = {
        name: name,
        code: code.toUpperCase(), // Adiciona a sigla
        type: 'ADMINISTRATIVA',
        parent_id: null,
      };

      const response = await axios.post(`${API_URL}/units`, newUnitData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      addToast('Unidade superior criada com sucesso!', 'success');
      onSaveSuccess(response.data.unit);

    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao criar unidade superior.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1002] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md relative">
        <h2 className="text-xl font-bold text-blue-900 mb-6">Adicionar Unidade Superior</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="parentUnitName" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Secretaria Executiva
            </label>
            <input
              type="text"
              id="parentUnitName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
              autoFocus
            />
          </div>
          {/* NOVO CAMPO DE SIGLA */}
          <div>
            <label htmlFor="parentUnitCode" className="block text-sm font-medium text-gray-700 mb-1">
              Sigla
            </label>
            <input
              type="text"
              id="parentUnitCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
              placeholder="Ex: SEAF"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParentUnitModal;