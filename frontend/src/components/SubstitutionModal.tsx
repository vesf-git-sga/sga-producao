import React, { useState, useMemo } from 'react';
import axios from 'axios';
import InputMask from 'react-input-mask'; 
import { Movement, Asset, useToast } from '../App';
import { X, Repeat, CheckCircle, Monitor, Square, CheckSquare, Smartphone, Save, Search, AlertTriangle } from 'lucide-react';

interface SubstitutionModalProps {
    movement: Movement;
    onClose: () => void;
    onSuccess: () => void;
    API_URL: string;
}

interface ReplacementItem {
    oldAsset: Asset;
    searchMode: 'patrimonio' | 'advanced'; 
    searchTerm: string; 
    searchResults: Asset[]; 
    foundAsset: Asset | null;
    isLoading: boolean;
    error: string;
    isSelected: boolean;
    isTablet: boolean; 
    currentChipNumber: string; 
    chipScope: 'tablet_only' | 'chip_only' | 'both'; 
    newSimNumber: string; 
    newImei: string;      
}

const SubstitutionModal = ({ movement, onClose, onSuccess, API_URL }: SubstitutionModalProps) => {
    const { addToast } = useToast();
    
    const [itemsToReplace, setItemsToReplace] = useState<ReplacementItem[]>(() => 
        (movement.assets || []).map(asset => {
            const type = asset.item_type_name ? asset.item_type_name.toLowerCase() : '';
            const isTablet = type.includes('tablet') || type.includes('ipad') || type.includes('galaxy') || type.includes('samsung tab');
            
            return { 
                oldAsset: asset, 
                searchMode: 'patrimonio', 
                searchTerm: '', 
                searchResults: [],
                foundAsset: null, 
                isLoading: false, 
                error: '',
                isSelected: false, 
                isTablet: isTablet,
                // @ts-ignore
                currentChipNumber: asset.sim_card_number || '', 
                chipScope: 'tablet_only',
                newSimNumber: '',
                newImei: ''
            };
        })
    );
    
    const [monitorSearchTerm, setMonitorSearchTerm] = useState('');
    const [newMonitorOptional, setNewMonitorOptional] = useState<Asset | null>(null);
    const [isMonitorLoading, setIsMonitorLoading] = useState(false);
    
    const [peripherals, setPeripherals] = useState({ mouse: true, teclado: true, fonte: true, cabos: true });
    const [otherPeripheral, setOtherPeripheral] = useState('');

    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const updateItemState = (index: number, updates: Partial<ReplacementItem>) => {
        setItemsToReplace(prev => {
            const n = [...prev];
            n[index] = { ...n[index], ...updates };
            return n;
        });
    };

    const toggleSelection = (index: number) => {
        const item = itemsToReplace[index];
        updateItemState(index, { isSelected: !item.isSelected });
    };

    const activeItems = useMemo(() => itemsToReplace.filter(i => i.isSelected), [itemsToReplace]);

    const desktopItem = useMemo(() => 
        activeItems.find(i => i.oldAsset.item_type_name.toLowerCase().includes('desktop') || i.oldAsset.item_type_name.toLowerCase().includes('computador')),
    [activeItems]);

    const monitorItemInList = useMemo(() => 
        activeItems.find(i => i.oldAsset.item_type_name.toLowerCase().includes('monitor')),
    [activeItems]);

    // --- VALIDAÇÃO DE TIPO (Compartilhada) ---
    const checkTypeCompatibility = (oldAsset: Asset, newAsset: Asset, isTabletContext: boolean) => {
        const oldType = (oldAsset.item_type_name || '').toLowerCase();
        const newType = (newAsset.item_type_name || '').toLowerCase();

        // 1. Nome exato bate?
        if (oldType === newType) return true;

        // 2. Ambos são tablets? (Ex: iPad por Galaxy Tab)
        const newIsTablet = newType.includes('tablet') || newType.includes('ipad') || newType.includes('galaxy') || newType.includes('tab');
        if (isTabletContext && newIsTablet) return true;

        // 3. Ambos são Monitores?
        if (oldType.includes('monitor') && newType.includes('monitor')) return true;

        // 4. Ambos são Desktops?
        if ((oldType.includes('desktop') || oldType.includes('computador')) && (newType.includes('desktop') || newType.includes('computador'))) return true;

        return false;
    };

    // --- BUSCA DIRETA (PATRIMÔNIO) ---
    const handleDirectValidation = async (index: number) => {
        const item = itemsToReplace[index];
        const term = item.searchTerm.trim();
        if(!term) { addToast('Digite um patrimônio.', 'warning'); return; }
        updateItemState(index, { isLoading: true, error: '' });

        try {
            const res = await axios.post(`${API_URL}/assets/validate-for-movement`, {
                patrimonio_number: term,
                movement_type: 'loan'
            });
            const newAsset = res.data;
            
            // >>> TRAVA RIGOROSA AQUI <<<
            const isCompatible = checkTypeCompatibility(item.oldAsset, newAsset, item.isTablet);

            if (isCompatible) {
                updateItemState(index, { 
                    foundAsset: newAsset, 
                    isLoading: false, 
                    error: '',
                    // @ts-ignore
                    newImei: newAsset.imei || '',
                    // @ts-ignore
                    newSimNumber: newAsset.sim_card_number || ''
                });
                addToast('Ativo validado!', 'success');
            } else {
                throw new Error(`Tipo Incompatível: O ativo informado é "${newAsset.item_type_name}", mas é necessário um "${item.oldAsset.item_type_name}".`);
            }
        } catch(e: any) {
            updateItemState(index, { foundAsset: null, isLoading: false, error: e.response?.data?.message || e.message || 'Erro' });
        }
    };

    // --- BUSCA AVANÇADA ---
    const handleAdvancedSearch = async (index: number) => {
        const item = itemsToReplace[index];
        if (item.searchTerm.length < 3) { addToast('Digite pelo menos 3 caracteres.', 'warning'); return; }
        updateItemState(index, { isLoading: true, error: '' });
        try {
            const res = await axios.get(`${API_URL}/assets/search-available?query=${item.searchTerm}`);
            updateItemState(index, { searchResults: res.data, isLoading: false, error: res.data.length === 0 ? 'Nenhum item disponível encontrado.' : '' });
        } catch (e: any) {
            updateItemState(index, { searchResults: [], isLoading: false, error: 'Erro na busca.' });
        }
    };

    // --- SELEÇÃO DA LISTA (TRAVA RIGOROSA ADICIONADA) ---
    const handleSelectFromList = (index: number, asset: Asset) => {
        const item = itemsToReplace[index];
        
        // >>> TRAVA RIGOROSA AQUI <<<
        const isCompatible = checkTypeCompatibility(item.oldAsset, asset, item.isTablet);

        if (!isCompatible) {
            addToast(`Bloqueado: Você não pode substituir um "${item.oldAsset.item_type_name}" por um "${asset.item_type_name}".`, 'error');
            return; // ABORTA A SELEÇÃO
        }

        updateItemState(index, {
            foundAsset: asset,
            searchTerm: asset.patrimonio_number || asset.sku,
            searchMode: 'patrimonio',
            searchResults: [],
            error: '',
            // @ts-ignore
            newImei: asset.imei || '',
            // @ts-ignore
            newSimNumber: asset.sim_card_number || ''
        });
    };

    const handleSearchMonitorOptional = async () => {
        if(!monitorSearchTerm) return;
        setIsMonitorLoading(true);
        try {
            const res = await axios.post(`${API_URL}/assets/validate-for-movement`, { patrimonio_number: monitorSearchTerm, movement_type: 'loan' });
            if (!res.data.item_type_name.toLowerCase().includes('monitor')) {
                addToast('O item informado não é um Monitor.', 'error');
                setNewMonitorOptional(null);
            } else {
                setNewMonitorOptional(res.data);
                addToast('Monitor vinculado!', 'success');
            }
        } catch (e: any) {
            addToast('Monitor não encontrado ou indisponível.', 'error');
            setNewMonitorOptional(null);
        } finally { setIsMonitorLoading(false); }
    };

    // Substitua apenas a função handleGenerateAndSave dentro de SubstitutionModal.tsx

    const handleGenerateAndSave = async () => {
        if (activeItems.length === 0) { addToast('Selecione item para substituir.', 'warning'); return; }
        if (!reason) { addToast('Informe o motivo.', 'warning'); return; }

        // Validação básica
        for (const item of activeItems) {
            if (!item.foundAsset && item.chipScope !== 'chip_only') {
                addToast(`Defina o novo equipamento para: ${item.oldAsset.patrimonio_number}`, 'error');
                return;
            }
        }

        if (!window.confirm("Confirma a solicitação de substituição?")) return;

        setIsProcessing(true);
        try {
            // 1. Prepara a lista do que está marcado visualmente
            const userSelectedPeripherals: string[] = [];
            if (peripherals.mouse) userSelectedPeripherals.push('Mouse');
            if (peripherals.teclado) userSelectedPeripherals.push('Teclado');
            if (peripherals.fonte) userSelectedPeripherals.push('Fonte');
            if (peripherals.cabos) userSelectedPeripherals.push('Cabos');
            if (otherPeripheral) userSelectedPeripherals.push(otherPeripheral);

            const pdfOldAssets: any[] = [];
            const pdfNewAssets: any[] = [];

            const promises = activeItems.map(async (item) => {
                let finalSimNumber = null;
                let finalImei = null;

                if (item.isTablet) {
                    finalSimNumber = (item.chipScope === 'tablet_only') ? item.currentChipNumber : item.newSimNumber;
                    finalImei = item.newImei;
                }

                // >>> CORREÇÃO AQUI: LÓGICA DE FILTRO POR TIPO <<<
                // Verifica se ESTE item específico é um computador.
                const type = (item.oldAsset.item_type_name || '').toLowerCase();
                const isComputer = type.includes('desktop') || type.includes('computador') || type.includes('notebook') || type.includes('laptop');
                
                // Se for computador, manda o que o usuário marcou. Se for Monitor/Tablet, manda lista vazia.
                const peripheralsToSend = isComputer ? userSelectedPeripherals : [];

                // Define monitores (apenas se for Desktop)
                const oldMonId = isComputer ? monitorItemInList?.oldAsset.id : null;
                const newMonId = isComputer ? (monitorItemInList?.foundAsset?.id || newMonitorOptional?.id) : null;

                const payload = {
                    oldAssetIds: [item.oldAsset.id],
                    newAssetIds: [item.foundAsset?.id || item.oldAsset.id],
                    
                    oldMonitorId: oldMonId, 
                    newMonitorId: newMonId,
                    
                    // Agora enviamos a lista filtrada
                    peripherals: { list: peripheralsToSend }, 
                    
                    // @ts-ignore
                    recipient_person_id: movement.recipient_person_id,
                    // @ts-ignore
                    destination_unit_id: movement.destination_unit_id,
                    reason: reason,
                    
                    purpose: `Substituição Técnica - ${reason}`,
                    request_channel_type: 'Ordem Direta', 
                    request_channel_details: 'Substituição via Sistema',

                    new_sim_number: finalSimNumber,
                    new_imei: finalImei
                };
                
                await axios.post(`${API_URL}/substitutions/start`, payload);
                
                pdfOldAssets.push({
                    ...item.oldAsset,
                    sim_card_number: item.currentChipNumber
                });

                pdfNewAssets.push({
                    ...(item.foundAsset || item.oldAsset),
                    sim_card_number: finalSimNumber,
                    imei: finalImei
                });
            });

            await Promise.all(promises);

            const keptItems = itemsToReplace.filter(i => !i.isSelected);
            keptItems.forEach(k => {
                pdfNewAssets.push({
                    ...k.oldAsset,
                    sim_card_number: k.currentChipNumber,
                    _isKept: true
                });
            });
            
            // Verifica se SOBROU algum item na lista global que seja Desktop para gerar o PDF corretamente
            const hasComputerInSelection = activeItems.some(i => {
                const t = (i.oldAsset.item_type_name || '').toLowerCase();
                return t.includes('desktop') || t.includes('computador') || t.includes('notebook');
            });

            const pdfPayload = {
                recipient_name: movement.recipient_person_full_name || movement.recipient_display_name,
                recipient_cpf: movement.recipient_person_cpf,
                recipient_registration: movement.recipient_person_registration,
                unit_name: movement.destination_unit_name,
                reason: reason,
                chipScope: activeItems.find(i => i.isTablet)?.chipScope || null,
                old_assets: pdfOldAssets,
                new_assets: pdfNewAssets,
                // Só manda periféricos para o PDF se tiver computador na troca
                peripherals: hasComputerInSelection ? { list: userSelectedPeripherals } : { list: [] }
            };

            addToast('Gerando termo de solicitação...', 'info');
            
            try {
                const pdfResponse = await axios.post(`${API_URL}/reports/preview-substitution-term`, pdfPayload, { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Solicitacao_Substituicao_${movement.recipient_display_name || 'Usuario'}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (e) {
                console.error("Erro ao gerar PDF (não bloqueante):", e);
            }

            addToast('Substituição enviada para Pendências com sucesso!', 'success');
            onSuccess(); 
            onClose();

        } catch (error: any) {
            console.error(error);
            addToast(error.response?.data?.message || 'Erro ao processar solicitação.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6"/></button>
                <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center"><Repeat className="w-6 h-6 mr-2"/> Substituição de Ativos</h2>
                
                <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                    <div className="space-y-3">
                        {itemsToReplace.map((item, index) => (
                            <div key={item.oldAsset.id} className={`p-4 border rounded-lg transition-colors ${item.isSelected ? 'bg-gray-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 opacity-60'}`}>
                                
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                                    <div className="flex items-center cursor-pointer" onClick={() => toggleSelection(index)}>
                                        {item.isSelected ? <CheckSquare className="w-5 h-5 text-blue-600 mr-2" /> : <Square className="w-5 h-5 text-gray-400 mr-2" />}
                                        <span className={`text-sm font-bold uppercase ${item.isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                                            {item.oldAsset.item_type_name}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500 font-mono">{item.oldAsset.patrimonio_number}</span>
                                    </div>
                                </div>

                                <div className={item.isSelected ? '' : 'pointer-events-none grayscale'}>
                                    {/* PAINEL TABLET */}
                                    {item.isTablet && (
                                        <div className={`mb-4 border rounded p-3 text-sm ${item.currentChipNumber ? 'bg-blue-100 border-blue-300' : 'bg-orange-50 border-orange-200'}`}>
                                            <div className="flex items-center gap-2 mb-2 font-bold text-gray-800">
                                                <Smartphone className="w-4 h-4"/> 
                                                {item.currentChipNumber ? <span className="text-blue-800">Chip Atual: {item.currentChipNumber}</span> : <span className="text-orange-700">Sem Chip Vinculado</span>}
                                            </div>
                                            <div className="flex flex-wrap gap-4 mt-2">
                                                <label className="flex items-center cursor-pointer"><input type="radio" checked={item.chipScope === 'tablet_only'} onChange={() => updateItemState(index, { chipScope: 'tablet_only', foundAsset: null, searchTerm: '' })} className="mr-1"/> Só Tablet <span className="text-xs text-gray-500 ml-1">(Mantém Chip)</span></label>
                                                <label className="flex items-center cursor-pointer"><input type="radio" checked={item.chipScope === 'chip_only'} onChange={() => updateItemState(index, { chipScope: 'chip_only', foundAsset: null, searchTerm: '' })} className="mr-1"/> Só Chip <span className="text-xs text-gray-500 ml-1">(Mantém Tablet)</span></label>
                                                <label className="flex items-center cursor-pointer"><input type="radio" checked={item.chipScope === 'both'} onChange={() => updateItemState(index, { chipScope: 'both', foundAsset: null, searchTerm: '' })} className="mr-1"/> Kit Completo <span className="text-xs text-gray-500 ml-1">(Troca Tudo)</span></label>
                                            </div>
                                        </div>
                                    )}

                                    {/* INPUT NOVO ATIVO */}
                                    {item.chipScope !== 'chip_only' && (
                                        <div className="mb-3 animate-fadeIn">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-xs font-bold text-gray-500">Novo {item.oldAsset.item_type_name} (Entrada)</label>
                                                <div className="flex gap-2 text-xs">
                                                    <button onClick={() => updateItemState(index, { searchMode: 'patrimonio', searchResults: [] })} className={`px-2 py-0.5 rounded ${item.searchMode === 'patrimonio' ? 'bg-blue-200 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}>Patrimônio</button>
                                                    <button onClick={() => updateItemState(index, { searchMode: 'advanced' })} className={`px-2 py-0.5 rounded ${item.searchMode === 'advanced' ? 'bg-blue-200 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}>Busca por Nome</button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <input type="text" className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder={item.searchMode === 'patrimonio' ? "Bipe o patrimônio..." : "Digite modelo, marca..."} value={item.searchTerm} onChange={e => updateItemState(index, { searchTerm: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (item.searchMode === 'patrimonio' ? handleDirectValidation(index) : handleAdvancedSearch(index))}/>
                                                <button onClick={() => item.searchMode === 'patrimonio' ? handleDirectValidation(index) : handleAdvancedSearch(index)} disabled={item.isLoading} className="bg-blue-600 text-white px-4 rounded text-sm hover:bg-blue-700 disabled:opacity-50">{item.isLoading ? '...' : <Search className="w-4 h-4"/>}</button>
                                            </div>
                                            {item.error && <div className="mt-1 text-xs text-red-600 font-bold">{item.error}</div>}
                                            
                                            {/* RESULTADOS DA BUSCA AVANÇADA */}
                                            {item.searchMode === 'advanced' && item.searchResults.length > 0 && (
                                                <div className="mt-2 border rounded max-h-32 overflow-y-auto bg-white shadow-inner">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Item</th><th className="p-2">Serial/Pat</th><th className="p-2"></th></tr></thead>
                                                        <tbody>
                                                            {item.searchResults.map(res => (
                                                                <tr key={res.id} className="border-t hover:bg-blue-50 cursor-pointer" onClick={() => handleSelectFromList(index, res)}>
                                                                    <td className="p-2">{res.brand} {res.model}</td>
                                                                    <td className="p-2">{res.patrimonio_number || res.serial_number}</td>
                                                                    <td className="p-2 text-right"><CheckCircle className="w-3 h-3 text-green-600"/></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {item.foundAsset && (
                                                <div className="mt-2 text-sm font-bold text-green-700 bg-green-50 p-2 rounded border border-green-200 flex items-center justify-between">
                                                    <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Selecionado: {item.foundAsset.patrimonio_number || item.foundAsset.serial_number}</span>
                                                    <span className="text-xs font-normal text-gray-500">{item.foundAsset.brand} {item.foundAsset.model}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* DADOS CHIP NOVO */}
                                    {item.isTablet && item.chipScope !== 'tablet_only' && (
                                        <div className="mt-3 pt-3 border-t border-gray-300 animate-fadeIn grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-purple-700 mb-1">Novo Chip</label>
                                                <InputMask mask="(99) 99999-9999" value={item.newSimNumber} onChange={e => updateItemState(index, { newSimNumber: e.target.value })}>
                                                    {(inputProps: any) => <input {...inputProps} type="text" className="w-full p-2 border border-purple-300 bg-purple-50 rounded text-sm font-bold" placeholder="(81) 9..." />}
                                                </InputMask>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Novo IMEI (Opcional)</label>
                                                <input type="text" value={item.newImei} onChange={e => updateItemState(index, { newImei: e.target.value })} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="IMEI..."/>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SEÇÃO DESKTOP / MONITOR OPCIONAL */}
                    {desktopItem && (
                        <div className="mt-4 space-y-4">
                            {!monitorItemInList && (
                                <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                    <div className="text-sm font-bold text-blue-800 mb-2 flex items-center"><Monitor className="w-4 h-4 mr-2"/> Novo Monitor (Opcional)</div>
                                    <div className="flex gap-2">
                                        <input type="text" className="w-full p-2 border rounded text-sm" placeholder="Patrimônio do Monitor..." value={monitorSearchTerm} onChange={e => setMonitorSearchTerm(e.target.value)} />
                                        <button onClick={handleSearchMonitorOptional} disabled={isMonitorLoading} className="bg-blue-600 text-white px-4 rounded text-sm">Validar</button>
                                    </div>
                                    {newMonitorOptional && <div className="mt-2 text-sm font-bold text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> ENTRA: {newMonitorOptional.patrimonio_number}</div>}
                                </div>
                            )}
                            <div className="p-4 border rounded-lg bg-gray-50">
                                <div className="text-sm font-bold text-gray-700 mb-2">Acessórios Enviados</div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                    <label className="flex items-center cursor-pointer"><input type="checkbox" checked={peripherals.mouse} onChange={e => setPeripherals({...peripherals, mouse: e.target.checked})} className="mr-2"/> Mouse</label>
                                    <label className="flex items-center cursor-pointer"><input type="checkbox" checked={peripherals.teclado} onChange={e => setPeripherals({...peripherals, teclado: e.target.checked})} className="mr-2"/> Teclado</label>
                                    <label className="flex items-center cursor-pointer"><input type="checkbox" checked={peripherals.fonte} onChange={e => setPeripherals({...peripherals, fonte: e.target.checked})} className="mr-2"/> Fonte</label>
                                    <label className="flex items-center cursor-pointer"><input type="checkbox" checked={peripherals.cabos} onChange={e => setPeripherals({...peripherals, cabos: e.target.checked})} className="mr-2"/> Cabos</label>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Outros Periféricos</label>
                                    <input type="text" value={otherPeripheral} onChange={(e) => setOtherPeripheral(e.target.value)} placeholder="Digite aqui..." className="w-full p-2 border rounded text-sm bg-white" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">Motivo</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Descreva o defeito..."></textarea>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-gray-800 mr-2">Cancelar</button>
                    <button onClick={handleGenerateAndSave} disabled={isProcessing} className="px-6 py-2 bg-green-600 text-white rounded font-bold shadow-md flex justify-center items-center">
                        {isProcessing ? 'Processando...' : <><Save className="w-5 h-5 mr-2" /> Confirmar Substituição</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubstitutionModal;