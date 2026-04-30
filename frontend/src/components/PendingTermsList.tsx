import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MailWarning, FileText, CheckCircle, Search, AlertTriangle, FileCheck, X, ArrowLeft, PhoneCall, Clock, CheckSquare, Square } from 'lucide-react';

interface PendingTermsListProps {
    API_URL: string;
    onBack: () => void;
}

const PendingTermsList: React.FC<PendingTermsListProps> = ({ API_URL, onBack }) => {
    const [batches, setBatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'atrasado' | 'atencao' | 'no_prazo'>('ALL');

    // Estado do Modal de Baixa (Agora com Checklist)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<any>(null);
    const [receivedDate, setReceivedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // Novos estados para o Checklist de Alunos
    const [checklistItems, setChecklistItems] = useState<any[]>([]);
    const [loadingChecklist, setLoadingChecklist] = useState(false);

    // Estado do Modal de Contato/Cobrança
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [contactNotes, setContactNotes] = useState('');
    const [contactHistory, setContactHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const loadPendingBatches = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/delivery-batches/pending-terms`);
            setBatches(res.data);
        } catch (error) {
            console.error("Erro ao carregar lotes pendentes:", error);
            alert("Erro ao carregar a lista de pendências.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPendingBatches();
    }, [API_URL]);

    const filteredBatches = batches.filter(b => {
        const matchesSearch = b.school_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              b.batch_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || b.statusTag === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // >>> NOVA LÓGICA DE ABERTURA DO MODAL DE BAIXA <<<
    const openModal = async (batch: any) => {
        setSelectedBatch(batch);
        setReceivedDate(new Date().toISOString().split('T')[0]);
        setNotes('');
        setIsModalOpen(true);
        
        // Busca os alunos reais que receberam o tablet
        setLoadingChecklist(true);
        setChecklistItems([]);
        try {
            const res = await axios.get(`${API_URL}/delivery-batches/${batch.batch_id}/items-for-terms`);
            // Mapeia garantindo que o checkbox comece de acordo com o banco
            const formattedItems = res.data.map((item: any) => ({
                ...item,
                term_received: item.term_received || false
            }));
            setChecklistItems(formattedItems);
        } catch (error) {
            console.error("Erro ao carregar alunos:", error);
            alert("Erro ao buscar a lista de alunos deste lote.");
        } finally {
            setLoadingChecklist(false);
        }
    };

    // Funções de manipulação do Checklist
    const handleToggleCheck = (itemId: number) => {
        setChecklistItems(prev => prev.map(item => 
            item.item_id === itemId ? { ...item, term_received: !item.term_received } : item
        ));
    };

    const handleToggleAll = (check: boolean) => {
        setChecklistItems(prev => prev.map(item => ({ ...item, term_received: check })));
    };

    const checkedCount = checklistItems.filter(i => i.term_received).length;
    const totalItems = checklistItems.length;

    // >>> NOVO ENVIO (COM O ARRAY DE ALUNOS) <<<
    const handleRegisterReturn = async () => {
        if (!receivedDate) return alert("A data de recebimento é obrigatória.");
        
        setSubmitting(true);
        try {
            await axios.put(`${API_URL}/delivery-batches/${selectedBatch.batch_id}/register-terms-checklist`, {
                received_date: receivedDate,
                notes: notes,
                checklist: checklistItems.map(item => ({
                    item_id: item.item_id,
                    term_received: item.term_received
                }))
            });
            
            alert('Baixa documental registrada com sucesso!');
            setIsModalOpen(false);
            loadPendingBatches();
        } catch (error) {
            console.error("Erro ao registrar:", error);
            alert("Erro ao registrar a devolutiva.");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusStyle = (tag: string) => {
        switch (tag) {
            case 'atrasado': return 'bg-red-100 text-red-700 border-red-200';
            case 'atencao': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-green-100 text-green-700 border-green-200';
        }
    };

    const getStatusText = (tag: string, daysPassed: number, businessDaysPassed: number) => {
        if (tag === 'atrasado') return `Atrasado há ${daysPassed - 21} dias corridos`;
        if (tag === 'atencao') return `Vence em ${21 - daysPassed} dias corridos`;
        return `No prazo (${businessDaysPassed} dias úteis)`;
    };

    const openContactModal = async (batch: any) => {
        setSelectedBatch(batch);
        setContactNotes(''); 
        setIsContactModalOpen(true);
        setContactHistory([]);
        
        setLoadingHistory(true);
        try {
            const res = await axios.get(`${API_URL}/delivery-batches/${batch.batch_id}/contact-history`);
            setContactHistory(res.data);
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleRegisterContact = async () => {
        setSubmitting(true);
        try {
            await axios.put(`${API_URL}/delivery-batches/${selectedBatch.batch_id}/register-contact`, {
                notes: contactNotes
            });
            alert('Cobrança registrada com sucesso!');
            setIsContactModalOpen(false);
            loadPendingBatches(); 
        } catch (error) {
            console.error("Erro ao registrar contato:", error);
            alert("Erro ao registrar o contato.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            
            {/* CABEÇALHO */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <button 
                        onClick={onBack}
                        className="text-blue-600 hover:underline flex items-center text-sm font-medium mb-2 transition-colors hover:text-blue-800"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o Monitoramento
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <FileText className="w-6 h-6 mr-2 text-blue-600" />
                        Painel Documental
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Monitoramento de Termos de Responsabilidade pendentes.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar escola ou lote..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button 
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${filterStatus === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Todos
                        </button>
                        <button 
                            onClick={() => setFilterStatus('atrasado')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${filterStatus === 'atrasado' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-red-600'}`}
                        >
                            Atrasados
                        </button>
                        <button 
                            onClick={() => setFilterStatus('atencao')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${filterStatus === 'atencao' ? 'bg-white shadow text-yellow-600' : 'text-gray-500 hover:text-yellow-600'}`}
                        >
                            Vencendo
                        </button>
                    </div>
                </div>
            </div>

            {/* TABELA DE PENDÊNCIAS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="px-6 py-4 font-bold">Unidade Escolar / Lote</th>
                                <th className="px-6 py-4 font-bold">Data da Entrega Física</th>
                                <th className="px-6 py-4 font-bold">Prazo Final (15 dias úteis)</th>
                                <th className="px-6 py-4 font-bold">Status Documental</th>
                                <th className="px-6 py-4 font-bold text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Buscando pendências...</td></tr>
                            ) : filteredBatches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium text-lg">Tudo em dia!</p>
                                        <p className="text-gray-400 text-sm mt-1">Nenhum lote pendente de termos encontrado para este filtro.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredBatches.map((batch) => (
                                    <tr key={batch.batch_id} className="hover:bg-blue-50/30 transition-colors">
                                        
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <p className="font-bold text-gray-800 mr-2">{batch.school_name}</p>
                                                {batch.contact_count > 0 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title={`Última vez: ${new Date(batch.last_contact_date).toLocaleDateString('pt-BR')}`}>
                                                        <PhoneCall className="w-3 h-3 mr-1" />
                                                        Cobrado {batch.contact_count}x
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">{batch.batch_name}</p>
                                        </td>

                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(batch.delivery_confirmation_date).toLocaleDateString('pt-BR')}
                                        </td>

                                        <td className="px-6 py-4 font-medium text-gray-800">
                                            {new Date(batch.deadline_date).toLocaleDateString('pt-BR')}
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center w-fit ${getStatusStyle(batch.statusTag)}`}>
                                                {batch.statusTag === 'atrasado' && <MailWarning className="w-3 h-3 mr-1.5" />}
                                                {batch.statusTag === 'atencao' && <AlertTriangle className="w-3 h-3 mr-1.5" />}
                                                {getStatusText(batch.statusTag, batch.days_passed, batch.business_days_passed)}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {(batch.statusTag === 'atencao' || batch.statusTag === 'atrasado') && (
                                                    <button 
                                                        onClick={() => openContactModal(batch)}
                                                        className="inline-flex items-center px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-md text-sm font-medium text-orange-700 hover:bg-orange-100 transition-all"
                                                        title="Registrar Cobrança"
                                                    >
                                                        <PhoneCall className="w-4 h-4" />
                                                    </button>
                                                )}
                                                
                                                <button 
                                                    onClick={() => openModal(batch)}
                                                    className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm"
                                                >
                                                    <FileCheck className="w-4 h-4 mr-1.5" />
                                                    Baixa Documental
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* >>> NOVO MODAL DE BAIXA (COM CHECKLIST DE ALUNOS) <<< */}
            {isModalOpen && selectedBatch && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                
                                <div className="flex justify-between items-start mb-4 border-b pb-4">
                                    <div className="flex items-center">
                                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                                            <FileCheck className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-lg leading-6 font-bold text-gray-900">Auditoria Documental</h3>
                                            <p className="text-sm text-gray-500">{selectedBatch.school_name}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-2 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Data do E-mail/Recebimento</label>
                                            <input 
                                                type="date" 
                                                value={receivedDate} 
                                                onChange={(e) => setReceivedDate(e.target.value)} 
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Status Automático</label>
                                            <div className={`w-full px-3 py-2 border rounded-md text-sm font-bold flex items-center ${checkedCount === totalItems && totalItems > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                                {checkedCount === totalItems && totalItems > 0 ? 'Completo (100%)' : 'Parcial / Pendente'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* O CHECKLIST DE ALUNOS */}
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                                            <span className="text-sm font-bold text-gray-700">Checklist de Termos de Responsabilidade</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleToggleAll(true)} className="text-xs text-blue-600 hover:underline">Marcar Todos</button>
                                                <span className="text-gray-300">|</span>
                                                <button onClick={() => handleToggleAll(false)} className="text-xs text-gray-500 hover:underline">Desmarcar Todos</button>
                                            </div>
                                        </div>
                                        
                                        <div className="max-h-60 overflow-y-auto p-2 bg-white">
                                            {loadingChecklist ? (
                                                <div className="p-4 text-center text-sm text-gray-500 animate-pulse">Buscando lista de alunos atendidos...</div>
                                            ) : checklistItems.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-gray-500">Nenhum aluno com entrega confirmada neste lote.</div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {checklistItems.map((item) => (
                                                        <label 
                                                            key={item.item_id} 
                                                            className={`flex items-center p-2 rounded cursor-pointer border ${item.term_received ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-gray-50 border-transparent'}`}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                checked={item.term_received}
                                                                onChange={() => handleToggleCheck(item.item_id)}
                                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <div className="ml-3 flex-1">
                                                                <p className={`text-sm font-medium ${item.term_received ? 'text-gray-900' : 'text-gray-700'}`}>
                                                                    {item.student_name}
                                                                </p>
                                                                <p className="text-xs text-gray-500">Matrícula: {item.registration_number}</p>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-gray-50 px-4 py-2 border-t text-xs font-medium text-gray-600 text-right">
                                            {checkedCount} de {totalItems} termos confirmados
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações da Auditoria (Opcional)</label>
                                        <textarea 
                                            rows={2} 
                                            placeholder="Ex: Gestora avisou que o aluno faltou e enviará o termo dele amanhã..." 
                                            value={notes} 
                                            onChange={(e) => setNotes(e.target.value)} 
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-row-reverse gap-2">
                                <button 
                                    type="button" 
                                    onClick={handleRegisterReturn} 
                                    disabled={submitting || loadingChecklist} 
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:w-auto sm:text-sm disabled:opacity-50"
                                >
                                    {submitting ? 'Salvando...' : 'Salvar Auditoria'}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE REGISTRO DE CONTATO (MANTIDO IGUAL - HISTÓRICO VISUAL) */}
            {isContactModalOpen && selectedBatch && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsContactModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center">
                                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
                                            <PhoneCall className="h-5 w-5 text-orange-600" />
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-lg leading-6 font-bold text-gray-900">Registrar Cobrança</h3>
                                            <p className="text-sm text-gray-500">{selectedBatch.school_name}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsContactModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Anotações do Novo Contato</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Ex: Falei com a gestora via WhatsApp. Ela prometeu enviar amanhã..."
                                        value={contactNotes}
                                        onChange={(e) => setContactNotes(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">A data de hoje e seu usuário serão registrados automaticamente.</p>
                                </div>

                                <div className="mt-6 border-t pt-4">
                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                        <Clock className="w-4 h-4 mr-1 text-gray-500"/> Histórico de Cobranças Deste Lote
                                    </h4>
                                    
                                    {loadingHistory ? (
                                        <p className="text-xs text-gray-500 animate-pulse">Buscando histórico no sistema...</p>
                                    ) : contactHistory.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">Nenhuma cobrança registrada anteriormente para esta escola.</p>
                                    ) : (
                                        <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300">
                                            {contactHistory.map(history => (
                                                <div key={history.id} className="bg-orange-50/50 p-3 rounded border border-orange-100 text-sm">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-gray-700 text-xs flex items-center">
                                                            <div className="w-2 h-2 rounded-full bg-orange-400 mr-1.5"></div>
                                                            {history.operator_name || 'Sistema'}
                                                        </span>
                                                        <span className="text-gray-500 text-[10px]">
                                                            {new Date(history.contact_date).toLocaleString('pt-BR')}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-xs whitespace-pre-wrap ml-3.5">
                                                        {history.contact_notes || 'Sem anotações detalhadas.'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </div>
                            
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-row-reverse gap-2 border-t">
                                <button
                                    type="button"
                                    onClick={handleRegisterContact}
                                    disabled={submitting || !contactNotes.trim()}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Salvando...' : 'Salvar Novo Contato'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsContactModalOpen(false)}
                                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingTermsList;