// frontend/src/components/UnitForm.tsx -> VERSÃO FINAL COM O FLUXO GUIADO

import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { X, Save } from 'lucide-react';
import InputMask from 'react-input-mask';
import Select from 'react-select'; // Usaremos o Select para a busca inteligente

// Interfaces movidas para dentro para tornar o componente mais autônomo
interface Unit {
  id: number;
  type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA';
  name: string;
  code?: string;
  parent_id?: number | null;
  status: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

interface UnitData {
    type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA' | '';
    name: string;
    code?: string;
    parent_id?: number | null;
    status: string;
    address?: string;
    contact_phone?: string;
    contact_email?: string;
    notes?: string;
}

interface UnitFormProps {
  units: Unit[];
  onClose: () => void;
  onUnitSaved: () => void;
  unitToEdit: Unit | null;
  API_URL: string;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const UnitForm: React.FC<UnitFormProps> = ({ onClose, onUnitSaved, unitToEdit, units, API_URL, addToast }) => {
  
  // Estado principal do formulário
  const [formData, setFormData] = useState<UnitData>(() => (
    unitToEdit ? { ...unitToEdit } : { type: '', name: '', status: 'active', parent_id: null }
  ));

  // Estados para controlar a lógica da interface (o "wizard")
  const [selectedParent, setSelectedParent] = useState<Unit | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Efeito para configurar o estado inicial no modo de edição
  useEffect(() => {
    if (unitToEdit && unitToEdit.parent_id) {
      const parent = units.find(u => u.id === unitToEdit.parent_id);
      setSelectedParent(parent || null);
    }
  }, [unitToEdit, units]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleParentSelect = (selectedOption: any) => {
    const parentId = selectedOption ? parseInt(selectedOption.value, 10) : null;
    setFormData(prev => ({ ...prev, parent_id: parentId }));
    setSelectedParent(units.find(u => u.id === parentId) || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.name) {
      addToast("Tipo e Nome da unidade são obrigatórios.", "error");
      return;
    }
    // Para unidades administrativas (exceto a própria SEDUC), a unidade superior é obrigatória
    if (formData.type === 'ADMINISTRATIVA' && !formData.parent_id && formData.name.toLowerCase() !== 'secretaria de educação') {
        addToast("Para Unidades Administrativas, a seleção da Unidade Superior é obrigatória.", "error");
        return;
    }
    setLoading(true);
    try {
      if (unitToEdit) {
        await axios.put(`${API_URL}/units/${unitToEdit.id}`, formData);
        addToast('Unidade atualizada com sucesso!', 'success');
      } else {
        await axios.post(`${API_URL}/units`, formData);
        addToast('Unidade criada com sucesso!', 'success');
      }
      onUnitSaved();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Ocorreu um erro ao salvar a unidade.';
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Prepara as opções para o campo de busca de Unidade Superior
  const parentUnitOptions = useMemo(() => 
    units
      .filter(unit => unit.type === formData.type) // Filtra pelo mesmo tipo da unidade sendo criada
      .map(unit => ({ value: unit.id.toString(), label: `${unit.name} (${unit.code || 'sem código'})` })),
    [units, formData.type]
  );
  
  const selectedParentOption = parentUnitOptions.find(opt => opt.value === formData.parent_id?.toString());

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">{unitToEdit ? 'Editar Unidade' : 'Adicionar Nova Unidade'}</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* ETAPA 1: ESCOLHA DO TIPO DE UNIDADE */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">1. Qual o tipo da unidade?</label>
              <select name="type" value={formData.type} onChange={handleChange} required className="w-full p-2 border rounded-md">
                  <option value="" disabled>Selecione o tipo...</option>
                  <option value="ADMINISTRATIVA">Unidade Administrativa (SEDUC)</option>
                  <option value="ESCOLAR">Unidade Escolar</option>
                  <option value="EXTERNA">Unidade Externa</option>
              </select>
            </div>
            
            {/* O RESTANTE DO FORMULÁRIO APARECE DE FORMA CONDICIONAL */}
            {formData.type && (
                <>
                  {/* SEÇÃO HIERARQUIA: APARECE PARA ADMINISTRATIVA E EXTERNA */}
                  {(formData.type === 'ADMINISTRATIVA' || formData.type === 'EXTERNA') && (
                      <div className="p-4 border rounded-lg bg-gray-50">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                              2. A qual unidade superior ela pertence?
                              {formData.type === 'ADMINISTRATIVA' && <span className="text-red-500"> *</span>}
                          </label>
                          <Select
                              options={parentUnitOptions}
                              value={selectedParentOption}
                              onChange={handleParentSelect}
                              placeholder="Busque a unidade pai (opcional para Externa)"
                              isClearable
                              required={formData.type === 'ADMINISTRATIVA'}
                          />
                          {selectedParent && <p className="text-xs text-gray-500 mt-1">Subordinada a: {selectedParent.name}</p>}
                      </div>
                  )}

                  {/* SEÇÃO DE DADOS PRINCIPAIS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                              {formData.type === 'ESCOLAR' ? 'Nome da Escola *' : 'Nome da Unidade *'}
                          </label>
                          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full p-2 border rounded-md" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                              {formData.type === 'ESCOLAR' ? 'Código INEP' : 'Código / Sigla'}
                          </label>
                          <input type="text" name="code" value={formData.code || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone de Contato</label>
                          <InputMask mask="(99) 99999-9999" value={formData.contact_phone || ''} onChange={handleChange} name="contact_phone">
                              {(inputProps: any) => <input {...inputProps} type="tel" className="w-full p-2 border rounded-md" />}
                          </InputMask>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contato</label>
                          <input type="email" name="contact_email" value={formData.contact_email || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                          <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded-md"></textarea>
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded-md"></textarea>
                      </div>
                  </div>
                </>
            )}

            <div className="flex justify-end space-x-3 mt-6 border-t pt-6">
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50">
                    <Save className="w-5 h-5 mr-2 inline-block"/>{loading ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default UnitForm;