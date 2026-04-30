import React, { useState } from 'react';
import { X, Plus, Trash2, FileText, Download, UploadCloud } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx'; // Certifique-se de ter instalado: npm install xlsx

interface LegacyDisposalModalProps {
    onClose: () => void;
    API_URL: string;
}

const LegacyDisposalModal = ({ onClose, API_URL }: LegacyDisposalModalProps) => {
    const [destination, setDestination] = useState('');
    const [items, setItems] = useState<{ description: string; quantity: string; observation: string }[]>([
        { description: '', quantity: '1', observation: '' }
    ]);
    const [loading, setLoading] = useState(false);

    const addItem = () => setItems([...items, { description: '', quantity: '1', observation: '' }]);
    
    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    // >>> NOVA FUNÇÃO: LER EXCEL <<<
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Array de arrays

            // Remove cabeçalho (assumindo linha 1) e mapeia
            // Formato esperado: [Descrição, Quantidade, Obs]
            const newItems: any[] = [];
            data.slice(1).forEach((row: any) => {
                if (row[0]) { // Se tiver descrição
                    newItems.push({
                        description: String(row[0]),
                        quantity: row[1] ? String(row[1]) : '1',
                        observation: row[2] ? String(row[2]) : ''
                    });
                }
            });

            if (newItems.length > 0) {
                setItems(prev => [...prev, ...newItems]); // Adiciona aos existentes ou substitui
                alert(`${newItems.length} itens importados da planilha.`);
            } else {
                alert('Nenhum dado válido encontrado. Verifique se a planilha tem: Descrição (A), Qtd (B), Obs (C).');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!destination || items.some(i => !i.description)) return alert('Preencha o destino e a descrição de todos os itens.');
        
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/reports/legacy-disposal`, {
                items,
                disposal_destination: destination,
                technician_name: 'Administrador'
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Termo_Descarte_Avulso_${new Date().getTime()}.pdf`);
            document.body.appendChild(link);
            link.click();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            onClose();
        } catch (error) { alert('Erro ao gerar documento.'); } 
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1005] p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
                <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center"><FileText className="w-6 h-6 mr-2 text-gray-600"/> Descarte Avulso (Sucata)</h2>
                
                <div className="flex justify-between items-end mb-4">
                    <p className="text-sm text-gray-500">Gere termos para materiais não cadastrados (Ex: Cabos, Monitores Antigos).</p>
                    <div>
                        <input type="file" id="legacyExcel" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                        <label htmlFor="legacyExcel" className="cursor-pointer bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center hover:bg-green-700">
                            <UploadCloud className="w-4 h-4 mr-1"/> Importar Excel
                        </label>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Destino Final</label>
                        <textarea value={destination} onChange={e => setDestination(e.target.value)} className="w-full p-2 border rounded-md" rows={2} placeholder="Ex: Doação para Reciclagem..." required />
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                                <input type="number" placeholder="Qtd" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-16 p-1 border rounded text-sm" />
                                <input type="text" placeholder="Descrição (ex: Mouse quebrado)" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="flex-1 p-1 border rounded text-sm" required />
                                <input type="text" placeholder="Obs" value={item.observation} onChange={e => updateItem(idx, 'observation', e.target.value)} className="w-1/3 p-1 border rounded text-sm" />
                                <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline flex items-center"><Plus className="w-4 h-4 mr-1"/> Adicionar Linha</button>

                    <div className="flex justify-end pt-4 border-t">
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-gray-800 text-white rounded-lg flex items-center hover:bg-gray-900 disabled:opacity-50">
                            {loading ? 'Gerando...' : <><Download className="w-4 h-4 mr-2"/> Gerar Termo PDF</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default LegacyDisposalModal;