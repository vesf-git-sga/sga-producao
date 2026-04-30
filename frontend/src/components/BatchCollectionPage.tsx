import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { 
    Printer, PackageCheck, FileText, CheckCircle2, 
    Truck, Search, X, AlertTriangle, Plus, UploadCloud, Database 
} from 'lucide-react';

interface BatchCollectionPageProps {
    API_URL: string;
    addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    units: any[];
}

const BatchCollectionPage: React.FC<BatchCollectionPageProps> = ({ API_URL, addToast, units }) => {
    // --- ESTADOS GERAIS ---
    const [itemTypes, setItemTypes] = useState<any[]>([]);

    // --- ESTADOS SEÇÃO 1: PLANEJAMENTO (EMISSÃO OR) ---
    const [planUnitId, setPlanUnitId] = useState('');
    const [planTechName, setPlanTechName] = useState('');
    const [planReason, setPlanReason] = useState('');
    const [planQty, setPlanQty] = useState(20);
    const [loadingPlan, setLoadingPlan] = useState(false);

    // --- ESTADOS SEÇÃO 2: EXECUÇÃO (PROCESSAMENTO) ---
    const [orCode, setOrCode] = useState('');
    const [activeOR, setActiveOR] = useState<any>(null);
    const [procUnitId, setProcUnitId] = useState('');
    const [procNotes, setProcNotes] = useState('');
    
    // Estado para o Arquivo de Upload
    const [receiptFile, setReceiptFile] = useState<File | null>(null);

    // Itens da Esteira
    const [items, setItems] = useState<any[]>([]);
    
    // Objeto do Item Atual
    const [currentItem, setCurrentItem] = useState({
        patrimonio: '', 
        serial: '', 
        itemTypeId: '', 
        brand: '',      
        model: '',      
        imei: '', 
        sim_card: '', 
        condition: 'Bom'
    });

    const [loadingProc, setLoadingProc] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false); // Estado visual de busca

    // Opções de Unidade (Filtra apenas ESCOLAR e ADMINISTRATIVA)
    const unitOptions = units
        .filter(u => ['ESCOLAR', 'ADMINISTRATIVA'].includes(u.type))
        .map(u => ({ value: u.id.toString(), label: u.name }))
        .sort((a, b) => a.label.localeCompare(b.label));

    // Carregar Tipos de Item ao montar
    useEffect(() => {
        axios.get(`${API_URL}/item-types`)
            .then(res => setItemTypes(res.data))
            .catch(err => console.error("Erro ao carregar tipos:", err));
    }, [API_URL]);

    // ========================================================================
    // AÇÃO DE LOOKUP (AUTO-PREENCHIMENTO COM ROTA EXISTENTE)
    // ========================================================================
    const handleAssetLookup = async (term: string) => {
        const cleanTerm = term.trim();
        if (!cleanTerm || cleanTerm.length < 3) return;
        
        // Evita chamadas se já estiver buscando
        if (isLookingUp) return;

        setIsLookingUp(true);
        try {
            // Usa a rota nativa do sistema que busca por Patrimônio ou Serial
            const response = await axios.get(`${API_URL}/query/asset/${encodeURIComponent(cleanTerm)}`);
            const asset = response.data;

            if (asset) {
                // Encontrou! Preenche os dados automaticamente
                setCurrentItem(prev => ({
                    ...prev,
                    // Preenche IDs e Nomes para garantir consistência
                    itemTypeId: asset.item_type_id ? asset.item_type_id.toString() : prev.itemTypeId,
                    brand: asset.brand || prev.brand,
                    model: asset.model || prev.model,
                    
                    // Dados técnicos (Se já existirem no banco, traz para conferência)
                    imei: asset.imei || prev.imei,
                    sim_card: asset.sim_card_number || prev.sim_card,
                    
                    // Garante que os identificadores batam 
                    patrimonio: asset.patrimonio_number || prev.patrimonio,
                    serial: asset.serial_number || prev.serial
                }));
                
                addToast(`Ativo identificado: ${asset.item_type_name || ''} ${asset.brand || ''}`, 'success');
            }
        } catch (error: any) {
            // Se der 404, apenas ignoramos (significa que é um ativo novo/legado)
            if (error.response?.status !== 404) {
                console.error("Erro no lookup:", error);
            }
        } finally {
            setIsLookingUp(false);
        }
    };

    // ========================================================================
    // AÇÃO 1: GERAR OR E IMPRIMIR
    // ========================================================================
    const handleGenerateOR = async () => {
        if (!planUnitId || !planTechName) return addToast('Selecione a Unidade e informe o Técnico.', 'warning');
        
        setLoadingPlan(true);
        try {
            const orRes = await axios.post(`${API_URL}/collection-orders`, {
                school_unit_id: planUnitId,
                technician_name: planTechName,
                reason: planReason,
                estimated_quantity: planQty
            });
            const orData = orRes.data;

            const schoolLabel = unitOptions.find(u => u.value === planUnitId)?.label;
            const pdfRes = await axios.post(`${API_URL}/reports/blank-collection-order`, {
                or_code: orData.code, 
                school_name: schoolLabel,
                technician_name: planTechName,
                collection_reason: planReason,
                estimated_quantity: planQty
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([pdfRes.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `OR_${orData.code}.pdf`);
            document.body.appendChild(link);
            link.click();
            
            addToast(`Ordem de Coleta ${orData.code} gerada com sucesso!`, 'success');
            setPlanUnitId(''); setPlanTechName(''); setPlanReason('');

        } catch (error: any) {
            addToast('Erro ao gerar Ordem de Coleta.', 'error');
        } finally {
            setLoadingPlan(false);
        }
    };

    // ========================================================================
    // AÇÃO 2: BUSCAR OR
    // ========================================================================
    const handleSearchOR = async () => {
        if (!orCode) return addToast('Digite o código da OR.', 'warning');
        setLoadingProc(true);
        try {
            const response = await axios.get(`${API_URL}/collection-orders/${orCode}`);
            const or = response.data;
            setActiveOR(or);
            setProcUnitId(or.school_unit_id.toString());
            setProcNotes(or.reason ? `[Ref. ${or.code}] ${or.reason}` : `[Ref. ${or.code}]`);
            addToast('Ordem localizada!', 'success');
        } catch (error: any) {
            setActiveOR(null); setProcUnitId('');
            if (error.response?.status === 404) addToast('Código não encontrado.', 'error');
            else if (error.response?.status === 409) addToast(error.response.data.message, 'warning');
            else addToast('Erro ao buscar OR.', 'error');
        } finally { setLoadingProc(false); }
    };

    // ========================================================================
    // AÇÃO 3: ADICIONAR ITEM NA LISTA
    // ========================================================================
    const handleAddItem = () => {
        // Validação Mínima
        if (!currentItem.patrimonio && !currentItem.serial) {
            return addToast('Informe pelo menos Patrimônio ou Serial.', 'warning');
        }
        
        // Verifica duplicidade visual
        if (items.some(i => (i.patrimonio && i.patrimonio === currentItem.patrimonio) || (i.serial && i.serial === currentItem.serial))) {
            return addToast('Item já está na lista.', 'warning');
        }

        // Busca o nome do tipo para exibir na tabela
        const typeName = itemTypes.find(t => t.id.toString() === currentItem.itemTypeId)?.name || 'Desconhecido';

        setItems([...items, { ...currentItem, itemTypeName: typeName }]);
        
        // Limpa para o próximo (mantém tipo, marca e modelo para agilizar digitação de lotes iguais)
        setCurrentItem(prev => ({ 
            ...prev, 
            patrimonio: '', 
            serial: '', 
            imei: '', 
            sim_card: '' 
        })); 
    };

    // ========================================================================
    // AÇÃO 4: PROCESSAR TUDO (UPLOAD + DADOS)
    // ========================================================================
    const handleProcessCollection = async () => {
        if (!procUnitId) return addToast('Unidade de origem obrigatória.', 'warning');
        if (items.length === 0) return addToast('Lista vazia.', 'warning');
        
        // Validação do Arquivo
        if (!receiptFile) return addToast('O upload do documento assinado (OR) é obrigatório.', 'error');

        if (!window.confirm(`Confirma o recolhimento de ${items.length} itens?`)) return;

        setLoadingProc(true);
        try {
            // Usamos FormData para enviar arquivo + dados
            const formData = new FormData();
            formData.append('school_unit_id', procUnitId);
            formData.append('notes', procNotes);
            formData.append('items', JSON.stringify(items)); // Array convertido para string
            if (activeOR) formData.append('or_code', activeOR.code);
            formData.append('receiptFile', receiptFile); // O arquivo físico

            const response = await axios.post(`${API_URL}/assets/process-collection`, formData);
            
            addToast(response.data.message, 'success');
            if (response.data.warnings?.length > 0) alert(`Atenção:\n${response.data.warnings.join('\n')}`);

            // Reset Total
            setItems([]); setOrCode(''); setActiveOR(null); setProcUnitId(''); setProcNotes(''); setReceiptFile(null);
            setCurrentItem({ patrimonio: '', serial: '', itemTypeId: '', brand: '', model: '', imei: '', sim_card: '', condition: 'Bom' });

        } catch (error: any) {
            addToast(error.response?.data?.message || 'Erro ao processar.', 'error');
        } finally { setLoadingProc(false); }
    };

    return (
        <div className="space-y-8 pb-20 animate-fadeIn">
            {/* CABEÇALHO */}
            <div>
                <h1 className="text-3xl font-extrabold text-blue-900 flex items-center">
                    <Truck className="w-8 h-8 mr-3" /> Devolução em Lote (Logística Reversa)
                </h1>
                <p className="text-gray-500 mt-1">Gestão de recolhimento: Planeje a coleta (OR) e processe a entrada no retorno.</p>
            </div>

            {/* SEÇÃO 1: PLANEJAMENTO */}
            <div className="bg-white rounded-xl shadow border border-blue-100 overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-blue-800">1. Planejamento (Emissão de OR)</h2>
                        <p className="text-xs text-blue-600">Gere o documento para o técnico.</p>
                    </div>
                    <Printer className="w-6 h-6 text-blue-300" />
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Unidade de Origem</label>
                        <Select 
                            options={unitOptions} 
                            onChange={(o: any) => setPlanUnitId(o.value)} 
                            value={unitOptions.find(u => u.value === planUnitId)} 
                            placeholder="Selecione..." 
                            className="text-sm"
                            menuPortalTarget={document.body} 
                            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                            menuPosition="fixed"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Técnico</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" value={planTechName} onChange={e => setPlanTechName(e.target.value)}/>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Qtd. Estimada</label>
                        <input type="number" className="w-full p-2 border rounded text-sm" value={planQty} onChange={e => setPlanQty(parseInt(e.target.value))}/>
                    </div>
                    <div className="md:col-span-1">
                        <button onClick={handleGenerateOR} disabled={loadingPlan} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded shadow flex items-center justify-center disabled:opacity-50">
                            {loadingPlan ? '...' : <><FileText className="w-4 h-4 mr-2"/> Gerar OR</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: EXECUÇÃO */}
            <div className="bg-white rounded-xl shadow border border-green-100 overflow-hidden">
                <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-green-900">2. Processamento (Entrada)</h2>
                        <p className="text-xs text-green-700">Validação e cadastro dos equipamentos retornados.</p>
                    </div>
                    <PackageCheck className="w-6 h-6 text-green-300" />
                </div>

                <div className="p-6 space-y-6">
                    {/* RASTREIO E DADOS GERAIS */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código OR</label>
                            <div className="flex">
                                <input type="text" className="w-full p-2 border rounded-l font-mono font-bold" placeholder="OR-..." value={orCode} onChange={e => setOrCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleSearchOR()} disabled={!!activeOR} />
                                {activeOR ? <button onClick={() => { setActiveOR(null); setOrCode(''); setProcUnitId(''); }} className="bg-red-100 text-red-600 px-3 border border-red-200 rounded-r"><X className="w-4 h-4"/></button> : <button onClick={handleSearchOR} className="bg-gray-200 text-gray-700 px-4 border border-gray-300 rounded-r font-bold">Buscar</button>}
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Origem {activeOR && '(Travado)'}</label>
                            <Select 
                                options={unitOptions} 
                                value={unitOptions.find(u => u.value === procUnitId)} 
                                onChange={o => !activeOR && setProcUnitId(o?.value || '')} 
                                isDisabled={!!activeOR} 
                                placeholder="Selecione..." 
                                className="text-sm"
                                menuPortalTarget={document.body} 
                                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                menuPosition="fixed"
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Obs. Geral</label>
                            <input type="text" className="w-full p-2 border rounded text-sm" value={procNotes} onChange={e => setProcNotes(e.target.value)}/>
                        </div>
                    </div>

                    {/* GRID DE ENTRADA (EXPANDIDO PARA 2 LINHAS) */}
                    <div className="border rounded-lg p-4 bg-gray-50 relative">
                        {/* Indicador de Busca */}
                        {isLookingUp && (
                            <div className="absolute top-2 right-2 flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded animate-pulse shadow-sm z-10">
                                <Database className="w-3 h-3 mr-1" /> Consultando Base...
                            </div>
                        )}

                        {!procUnitId && (
                            <div className="mb-4 text-sm text-yellow-700 bg-yellow-50 p-2 rounded flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-2"/> Selecione a origem ou a OR primeiro.
                            </div>
                        )}

                        <div className={`grid grid-cols-1 md:grid-cols-5 gap-3 items-end ${!procUnitId ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* LINHA 1: IDENTIFICAÇÃO BÁSICA E TIPO */}
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Patrimônio</label>
                                <input 
                                    type="text" 
                                    className="w-full p-1.5 border rounded text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" 
                                    value={currentItem.patrimonio} 
                                    onChange={e => setCurrentItem({...currentItem, patrimonio: e.target.value})} 
                                    onBlur={() => handleAssetLookup(currentItem.patrimonio)} 
                                    onKeyDown={e => e.key === 'Enter' && handleAddItem()} 
                                    placeholder="Tombo" autoFocus 
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Nº Série</label>
                                <input 
                                    type="text" 
                                    className="w-full p-1.5 border rounded text-sm font-mono" 
                                    value={currentItem.serial} 
                                    onChange={e => setCurrentItem({...currentItem, serial: e.target.value})} 
                                    onBlur={() => !currentItem.patrimonio && handleAssetLookup(currentItem.serial)} 
                                    placeholder="Serial" 
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Item</label>
                                <select className="w-full p-1.5 border rounded text-sm bg-white" value={currentItem.itemTypeId} onChange={e => setCurrentItem({...currentItem, itemTypeId: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {itemTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Marca</label>
                                <input type="text" className="w-full p-1.5 border rounded text-sm" value={currentItem.brand} onChange={e => setCurrentItem({...currentItem, brand: e.target.value})} placeholder="Ex: Samsung" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Modelo</label>
                                <input type="text" className="w-full p-1.5 border rounded text-sm" value={currentItem.model} onChange={e => setCurrentItem({...currentItem, model: e.target.value})} placeholder="Ex: A7 Lite" />
                            </div>

                            {/* LINHA 2: DETALHES TÉCNICOS E AÇÃO */}
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Chip</label>
                                <input type="text" className="w-full p-1.5 border rounded text-sm" value={currentItem.sim_card} onChange={e => setCurrentItem({...currentItem, sim_card: e.target.value})} placeholder="Apenas números" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">IMEI</label>
                                <input type="text" className="w-full p-1.5 border rounded text-sm" value={currentItem.imei} onChange={e => setCurrentItem({...currentItem, imei: e.target.value})} placeholder="Opcional" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Condição</label>
                                <select className="w-full p-1.5 border rounded text-sm bg-white" value={currentItem.condition} onChange={e => setCurrentItem({...currentItem, condition: e.target.value})}>
                                    <option value="Bom">Bom / Funcional</option>
                                    <option value="Ruim">Manutenção</option>
                                    <option value="Defeito">Sucata</option>
                                </select>
                            </div>
                             <div className="md:col-span-2">
                                <button onClick={handleAddItem} className="w-full bg-green-600 text-white p-1.5 rounded font-bold hover:bg-green-700 text-sm h-[34px] flex items-center justify-center">
                                    <Plus className="w-4 h-4 mr-1"/> Adicionar Item
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE ITENS */}
                    {items.length > 0 && (
                        <div className="overflow-hidden border rounded-lg max-h-60 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase sticky top-0">
                                    <tr>
                                        <th className="p-3">Patrimônio</th>
                                        <th className="p-3">Detalhes</th>
                                        <th className="p-3">Dados Técnicos</th>
                                        <th className="p-3">Condição</th>
                                        <th className="p-3 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((it, idx) => (
                                        <tr key={idx} className="bg-white hover:bg-gray-50">
                                            <td className="p-3 font-mono font-bold text-blue-600">{it.patrimonio || 'NOVO'}</td>
                                            <td className="p-3">
                                                <p className="font-bold text-xs">{it.itemTypeName}</p>
                                                <p className="text-xs text-gray-500">{it.brand} {it.model}</p>
                                            </td>
                                            <td className="p-3 text-xs text-gray-500">
                                                {it.sim_card && <span className="block">Chip: {it.sim_card}</span>}
                                                {it.imei && <span className="block">IMEI: {it.imei}</span>}
                                            </td>
                                            <td className="p-3">{it.condition}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 font-bold text-xs">Remover</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* RODAPÉ COM UPLOAD DE ARQUIVO */}
                    <div className="flex flex-col md:flex-row justify-between items-center pt-4 border-t border-gray-200 gap-4">
                        
                        {/* ÁREA DE UPLOAD */}
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-green-800 uppercase mb-2">
                                Documento Assinado (OR Digitalizada) *
                            </label>
                            <div className="flex items-center gap-2">
                                <label className="flex-1 cursor-pointer bg-white border border-green-300 border-dashed rounded-lg p-3 hover:bg-green-50 transition-colors flex items-center justify-center text-sm text-green-700">
                                    <UploadCloud className="w-5 h-5 mr-2" />
                                    {receiptFile ? receiptFile.name : 'Clique para anexar o PDF/Foto'}
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={e => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                </label>
                                {receiptFile && (
                                    <button onClick={() => setReceiptFile(null)} className="text-red-500 hover:text-red-700">
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">Total de Itens: <span className="text-lg font-bold text-gray-800">{items.length}</span></p>
                            <button onClick={handleProcessCollection} disabled={loadingProc || items.length === 0} className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center disabled:opacity-50">
                                {loadingProc ? 'Salvando...' : <><CheckCircle2 className="w-5 h-5 mr-2"/> Processar Entrada</>}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BatchCollectionPage;