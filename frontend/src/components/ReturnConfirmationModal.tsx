// frontend/src/components/ReturnConfirmationModal.tsx

import React, { useState, useEffect } from 'react';
import { Movement, Peripheral } from '../App';
import { X, Upload, FileText, Printer, CheckCircle, AlertTriangle, Package } from 'lucide-react';
import axios from 'axios';

interface ReturnConfirmationModalProps {
  movement: Movement;
  onClose: () => void;
  onConfirm: (notes: string, returnedPeripherals: Peripheral[], file?: File, condition?: string, selectedAssetIds?: number[]) => void;
  API_URL: string;
}

const ReturnConfirmationModal = ({ movement, onClose, onConfirm, API_URL }: ReturnConfirmationModalProps) => {
  const [activeTab, setActiveTab] = useState<'print' | 'upload'>('print');
  
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [returnCondition, setReturnCondition] = useState('good');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Controle de Seleção de Ativos (Devolução Parcial)
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);

  const [returnedPeripherals, setReturnedPeripherals] = useState<Peripheral[]>(
    movement.peripherals?.map(p => ({ ...p, status: 'returned' })) || []
  );

  useEffect(() => {
    // Inicia sem seleção para forçar a conferência do técnico
  }, [movement]);

  const toggleAsset = (id: number) => {
      setSelectedAssetIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  // --- FILTRO DE ATIVOS REAIS SELECIONADOS ---
  const getSelectedRealAssets = () => {
    return (movement.assets || []).filter(a => 
        a.patrimonio_number && 
        a.patrimonio_number.length > 2 &&
        selectedAssetIds.includes(a.id)
    );
  };

  // OPÇÃO 1: Gerar Recibo
  const handleGenerateReceipt = async () => {
    if (selectedAssetIds.length === 0) {
        window.alert("Selecione ao menos um item para gerar o recibo.");
        return;
    }

    setIsProcessing(true);
    try {
        const token = localStorage.getItem('token'); 
        const assetsToPrint = getSelectedRealAssets();
        
        const response = await axios.post(
            `${API_URL}/reports/preview-return-term`, 
            {
                recipient_name: movement.recipient_display_name,
                recipient_cpf: movement.recipient_person_cpf || '',
                recipient_registration: movement.recipient_person_registration || '',
                unit_name: movement.destination_unit_name || '',
                assets: assetsToPrint,
                reason: notes
            },
            {
                headers: { Authorization: `Bearer ${token}` }, 
                responseType: 'blob' 
            }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const safeName = (movement.recipient_display_name || 'Servidor').replace(/[^a-z0-9]/gi, '_');
        link.setAttribute('download', `Termo_Devolucao_${safeName}.pdf`);
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        link.parentNode?.removeChild(link);
        
        if (window.confirm("Recibo gerado!\n\nDeseja ir para a aba de anexar o documento assinado?")) {
            setActiveTab('upload');
        }
        
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        window.alert("Erro ao gerar o recibo de devolução.");
    } finally {
        setIsProcessing(false);
    }
  };

  // OPÇÃO 2: Confirmar com Upload
  const handleSubmitWithFile = () => {
    if (!file) {
        window.alert("Por favor, anexe o arquivo assinado.");
        return;
    }
    if (selectedAssetIds.length === 0) {
        window.alert("Selecione ao menos um item para devolver.");
        return;
    }

    setIsProcessing(true);
    onConfirm(notes, returnedPeripherals, file, returnCondition, selectedAssetIds);
  };

  // Trava a edição na aba de upload
  const isSelectionLocked = activeTab === 'upload';

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1002] p-4 backdrop-blur-sm">
      {/* Adicionei 'border border-gray-200' aqui para definir melhor o modal contra o fundo */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative flex flex-col max-h-[90vh] border border-gray-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center shrink-0 p-6 pb-0">
          <FileText className="w-6 h-6 mr-2" /> Registrar Devolução
        </h2>
        
        <div className="overflow-y-auto px-6 pb-6">
            
            {/* Abas de Escolha */}
            <div className="flex border-b border-gray-200 mb-6 shrink-0 mt-4">
                <button 
                    onClick={() => setActiveTab('print')}
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'print' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Printer className="w-4 h-4 inline-block mr-1"/> 1. Selecionar e Gerar
                </button>
                <button 
                    onClick={() => setActiveTab('upload')}
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'upload' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Upload className="w-4 h-4 inline-block mr-1"/> 2. Anexar e Finalizar
                </button>
            </div>

            {/* LISTA DE SELEÇÃO (Estilo Cartão) */}
            <div className={`transition-opacity duration-300 ${isSelectionLocked ? 'opacity-60 grayscale' : 'opacity-100'}`}>
                <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-800 font-bold flex items-center">
                        <Package className="w-4 h-4 mr-2"/> Itens para Devolução:
                    </p>
                    {isSelectionLocked ? (
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Seleção Bloqueada</span>
                    ) : (
                        <span className="text-xs text-blue-600 font-medium">Clique para selecionar</span>
                    )}
                </div>
                
                {/* Container da Lista com Borda Sólida */}
                <div className={`space-y-2 max-h-48 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg ${isSelectionLocked ? 'pointer-events-none' : ''}`}>
                    {movement.assets && movement.assets.map(asset => {
                        const isSelected = selectedAssetIds.includes(asset.id);
                        return (
                            <div 
                                key={asset.id} 
                                onClick={() => !isSelectionLocked && toggleAsset(asset.id)}
                                // Lógica visual refeita: Cartão Branco com borda definida quando não selecionado
                                className={`flex items-center p-3 rounded-md border transition-all duration-200 cursor-pointer shadow-sm
                                    ${isSelected 
                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                        : 'bg-white border-gray-300 hover:border-blue-300 hover:shadow-md'
                                    }
                                `}
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 border transition-colors
                                    ${isSelected 
                                        ? 'bg-blue-600 border-blue-600' 
                                        : 'bg-white border-gray-300'
                                    }`}
                                >
                                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div>
                                    <div className={`text-xs font-bold uppercase ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                        {asset.item_type_name}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                                        {asset.patrimonio_number || 'S/N'} | {asset.brand} {asset.model}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {(!movement.assets || movement.assets.length === 0) && <p className="text-xs text-gray-500 italic text-center py-2">Nenhum ativo vinculado.</p>}
                </div>
                
                <p className="text-right text-xs text-gray-500 font-medium mt-2">
                    {selectedAssetIds.length} item(ns) selecionado(s).
                </p>
            </div>

            <hr className="my-6 border-gray-200"/>

            {/* Periféricos (Apenas Visualização) */}
            {returnedPeripherals.length > 0 && (
                <div className="mb-6 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Acessórios Vinculados</p>
                    <ul className="text-sm space-y-1 text-gray-700">
                        {returnedPeripherals.map((p, i) => (
                            <li key={i} className="flex justify-between items-center">
                                <span>{p.quantity}x {p.peripheral_type}</span>
                                {selectedAssetIds.length > 0 && <CheckCircle className="w-3 h-3 text-green-500"/>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Campos de Texto (Condição e Obs) */}
            <div className={`space-y-4 mb-6 transition-opacity ${isSelectionLocked ? 'opacity-70 pointer-events-none' : ''}`}>
                 <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Condição do Material</label>
                        <select 
                            value={returnCondition} 
                            onChange={(e) => setReturnCondition(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="good">Bom Estado (Retorna ao Estoque)</option>
                            <option value="defective">Com Defeito (Vai para Manutenção)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações / Motivo</label>
                        <input 
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Fim de contrato; Devolvido apenas o monitor..."
                        />
                    </div>
                </div>
            </div>

            {/* Conteúdo da Aba Ativa (Botões) */}
            {activeTab === 'print' && (
                <div className="text-center animate-fadeIn">
                    <button 
                        onClick={handleGenerateReceipt} 
                        disabled={isProcessing || selectedAssetIds.length === 0}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isProcessing ? 'Processando...' : <><Printer className="w-5 h-5 mr-2" /> Gerar Recibo PDF</>}
                    </button>
                    {selectedAssetIds.length === 0 && <p className="text-xs text-red-500 mt-2 font-medium">Selecione ao menos um item na lista acima.</p>}
                </div>
            )}

            {activeTab === 'upload' && (
                <div className="animate-fadeIn space-y-4">
                    <div className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                        <input 
                            type="file" 
                            id="fileUpload" 
                            className="hidden" 
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                        />
                        <label htmlFor="fileUpload" className="cursor-pointer w-full h-full flex flex-col items-center">
                            {file ? (
                                <>
                                    <CheckCircle className="w-10 h-10 text-green-600 mb-2" />
                                    <span className="text-sm text-green-800 font-bold">{file.name}</span>
                                    <span className="text-xs text-green-600">Clique para alterar</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-700 font-medium">Clique para anexar o termo assinado</span>
                                    <span className="text-xs text-gray-400 mt-1">PDF, JPG ou PNG</span>
                                </>
                            )}
                        </label>
                    </div>

                    {returnCondition === 'defective' && (
                        <div className="flex items-center p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200 font-medium">
                            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                            Atenção: Os itens selecionados serão marcados como "Defeituosos".
                        </div>
                    )}

                    <button 
                        onClick={handleSubmitWithFile} 
                        disabled={isProcessing || selectedAssetIds.length === 0}
                        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isProcessing ? 'Salvando...' : <><CheckCircle className="w-5 h-5 mr-2" /> Finalizar Devolução</>}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ReturnConfirmationModal;