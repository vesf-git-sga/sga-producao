import React, { useState, useContext } from 'react';
import axios from 'axios';
import InputMask from 'react-input-mask';
import { X, Smartphone, Search, Save, UserCircle, RefreshCw } from 'lucide-react';
// Certifique-se de importar o AuthContext/User se necessário, ou remova se não usar
// import { AuthContext } from '../App'; 

interface SimSwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    API_URL: string;
    addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const SimSwapModal: React.FC<SimSwapModalProps> = ({ isOpen, onClose, onSuccess, API_URL, addToast }) => {
    const [step, setStep] = useState(1);
    const [matricula, setMatricula] = useState('');
    const [loading, setLoading] = useState(false);
    const [studentData, setStudentData] = useState<any>(null);
    
    // Dados do Formulário
    const [newSim, setNewSim] = useState('');
    const [currentImei, setCurrentImei] = useState(''); // Estado para o IMEI (editável)
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!matricula) return addToast('Digite a matrícula.', 'warning');
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/tablets/student-status/${matricula}`);
            const data = response.data;

            // Valida se o aluno tem tablet ativo para trocar o chip
            if (!data.asset_id || !['realizada', 'confirmed', 'loaned', 'in_use'].includes(data.delivery_status)) {
                addToast('Aluno não possui tablet ativo/entregue para realizar troca de chip.', 'warning');
                setLoading(false);
                return;
            }

            setStudentData(data);
            // Preenche o IMEI com o que está no banco, permitindo edição
            setCurrentImei(data.imei || ''); 
            setStep(2);
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Erro ao buscar aluno.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newSim || newSim.replace(/\D/g, '').length < 10) return addToast('Número do chip inválido.', 'warning');
        if (!reason) return addToast('Informe o motivo.', 'warning');

        if (!window.confirm('Confirma a ativação do novo chip para este equipamento?')) return;

        setLoading(true);
        try {
            await axios.put(`${API_URL}/assets/${studentData.asset_id}/swap-sim`, {
                new_sim_number: newSim,
                new_imei: currentImei, // Envia o IMEI (editado ou original)
                reason: reason
            });

            addToast('Chip trocado e cadastro atualizado!', 'success');
            onSuccess();
            handleClose();
        } catch (error: any) {
            addToast(error.response?.data?.message || 'Erro ao salvar.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setMatricula('');
        setStudentData(null);
        setNewSim('');
        setCurrentImei('');
        setReason('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1005] p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg relative">
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6"/></button>
                
                <h2 className="text-xl font-bold text-purple-900 mb-1 flex items-center">
                    <Smartphone className="w-6 h-6 mr-2"/> Troca de Chip / Manutenção
                </h2>
                <p className="text-sm text-gray-500 mb-6">Substituição de conectividade e ajuste cadastral.</p>

                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Matrícula do Aluno</label>
                            <input 
                                type="text" 
                                value={matricula} 
                                onChange={e => setMatricula(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="w-full p-2 border rounded mt-1 outline-none focus:ring-2 focus:ring-purple-500" 
                                placeholder="Digite a matrícula..." 
                                autoFocus
                            />
                        </div>
                        <button onClick={handleSearch} disabled={loading} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-bold disabled:opacity-50 flex justify-center items-center">
                            {loading ? 'Buscando...' : <><Search className="w-4 h-4 mr-2"/> Consultar</>}
                        </button>
                    </div>
                )}

                {step === 2 && studentData && (
                    <div className="space-y-5 animate-fadeIn">
                        
                        {/* CARD ALUNO */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex items-start mb-3">
                                <UserCircle className="w-10 h-10 text-gray-400 mr-3 mt-1"/>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg">{studentData.student_name}</h3>
                                    {/* CORREÇÃO APLICADA AQUI: FALLBACK DA MATRÍCULA */}
                                    <p className="text-sm text-gray-500">
                                        Matrícula: <span className="font-mono font-bold text-gray-700">{studentData.student_registration || matricula}</span>
                                    </p>
                                    <p className="text-xs text-gray-400">{studentData.school_name}</p>
                                </div>
                            </div>
                        </div>

                        {/* DADOS TÉCNICOS */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Equipamento Atual</label>
                                <div className="p-2 bg-gray-100 rounded text-sm text-gray-800 font-medium">
                                    {studentData.brand} {studentData.model} ({studentData.patrimonio_number})
                                </div>
                            </div>

                            {/* CAMPO IMEI EDITÁVEL */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-bold text-gray-700 mb-1">IMEI do Equipamento</label>
                                <input 
                                    type="text" 
                                    value={currentImei} 
                                    onChange={e => setCurrentImei(e.target.value)} 
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                    placeholder="Digite o IMEI correto..."
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Verifique na etiqueta traseira.</p>
                            </div>

                            {/* CHIP ATUAL (Somente Leitura) */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-gray-500 mb-1">Chip Atual (Sistema)</label>
                                <input 
                                    type="text" 
                                    value={studentData.sim_card_number || 'Sem Registro'} 
                                    disabled 
                                    className="w-full p-2 border bg-gray-100 rounded text-gray-500"
                                />
                            </div>
                        </div>

                        <hr className="border-gray-200"/>

                        {/* NOVO CHIP */}
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <label className="block text-sm font-bold text-purple-900 mb-1">Novo Número do Chip *</label>
                            <InputMask mask="(99) 99999-9999" value={newSim} onChange={e => setNewSim(e.target.value)}>
                                {(inputProps: any) => (
                                    <input 
                                        {...inputProps} 
                                        type="text" 
                                        className="w-full p-2 border border-purple-300 rounded text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                        placeholder="(81) 9..." 
                                        autoFocus
                                    />
                                )}
                            </InputMask>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Troca</label>
                            <select 
                                value={reason} 
                                onChange={e => setReason(e.target.value)} 
                                className="w-full p-2 border rounded bg-white"
                            >
                                <option value="">Selecione...</option>
                                <option value="Perda/Roubo">Perda/Roubo</option>
                                <option value="Defeito no Chip">Defeito no Chip</option>
                                <option value="Bloqueio">Bloqueio</option>
                                <option value="Atualização Cadastral">Apenas Atualização Cadastral</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                            <button onClick={() => { setStep(1); setStudentData(null); }} className="w-1/3 bg-gray-200 text-gray-800 py-2 rounded font-medium">Voltar</button>
                            <button onClick={handleSave} disabled={loading} className="w-2/3 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-bold shadow flex justify-center items-center disabled:opacity-50">
                                {loading ? 'Salvando...' : <><RefreshCw className="w-4 h-4 mr-2"/> Confirmar Troca</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimSwapModal;