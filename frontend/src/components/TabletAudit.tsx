import React, { useState } from 'react';
import axios from 'axios';
import { Search, FileText, Eye, MapPin, User, CheckCircle, Clock, Smartphone } from 'lucide-react'; // Adicionado Smartphone

interface TabletAuditProps {
  API_URL: string;
  addToast: any;
}

const TabletAudit: React.FC<TabletAuditProps> = ({ API_URL, addToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchTerm.length < 3) return addToast('Digite pelo menos 3 caracteres.', 'warning');

    setLoading(true);
    setSearched(true);
    try {
      const res = await axios.get(`${API_URL}/tablets/audit/search`, { params: { q: searchTerm } });
      setResults(res.data);
    } catch (error) {
      addToast('Erro ao buscar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadTerm = async (itemId: number, studentName: string) => {
    addToast('Gerando cópia do Termo...', 'info');
    try {
      const response = await axios.get(`${API_URL}/reports/delivery-item/${itemId}/term`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Termo_Auditoria_${studentName}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (error) { addToast('Erro ao gerar documento.', 'error'); }
  };

  const viewSignedReceipt = async (batchId: number) => {
    addToast('Buscando recibo digitalizado...', 'info');
    try {
      const response = await axios.get(`${API_URL}/delivery-batches/${batchId}/signed-receipt`, { responseType: 'blob' });
      const file = new Blob([response.data], { type: response.headers['content-type'] });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (error: any) { 
        if (error.response && error.response.status === 404) {
            const reader = new FileReader();
            reader.onload = () => {
                const msg = JSON.parse(reader.result as string).message;
                addToast(`Aviso: ${msg}`, 'warning');
            };
            reader.readAsText(error.response.data);
        } else {
            addToast('Erro ao abrir recibo.', 'error'); 
        }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
        <h1 className="text-2xl font-extrabold text-blue-900 flex items-center mb-2">
            <Search className="w-6 h-6 mr-2"/> Auditoria e Consulta
        </h1>
        <p className="text-gray-500 mb-6">Pesquise para verificar status de entrega, conectividade e comprovantes.</p>

        <form onSubmit={handleSearch} className="flex gap-2">
            <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Busque por Aluno, Escola, Patrimônio, Chip ou IMEI..." 
                className="flex-1 p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
            />
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Pesquisando...' : 'Buscar'}
            </button>
        </form>
      </div>

      {searched && (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-bold text-gray-700">Resultados da Busca ({results.length})</h3>
            </div>
            
            {results.length === 0 ? (
                <div className="p-10 text-center text-gray-400">Nenhum registro encontrado.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 border-b">
                            <tr>
                                <th className="px-6 py-3">Aluno / Matrícula</th>
                                <th className="px-6 py-3">Unidade Escolar</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Equipamento</th>
                                {/* NOVA COLUNA */}
                                <th className="px-6 py-3">Conectividade</th>
                                <th className="px-6 py-3 text-right">Evidências</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {results.map((row) => (
                                <tr key={row.student_id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <User className="w-4 h-4 mr-2 text-gray-400"/>
                                            <div>
                                                <p className="font-bold text-gray-800">{row.student_name}</p>
                                                <p className="text-xs text-gray-500">{row.student_registration}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <MapPin className="w-4 h-4 mr-2 text-gray-400"/>
                                            <div>
                                                <p className="text-gray-800">{row.school_name}</p>
                                                <p className="text-xs text-gray-500">RPA {row.rpa}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {row.delivery_status === 'realizada' || row.delivery_status === 'confirmed' ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="w-3 h-3 mr-1"/> Entregue
                                                <span className="ml-2 text-gray-500 font-normal">
                                                    {row.delivery_date ? new Date(row.delivery_date).toLocaleDateString('pt-BR') : ''}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <Clock className="w-3 h-3 mr-1"/> {row.delivery_status || 'Pendente'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {row.patrimonio_number ? (
                                            <span className="font-mono text-gray-700 font-bold">{row.patrimonio_number}</span>
                                        ) : '-'}
                                    </td>
                                    
                                    {/* NOVA CÉLULA: DADOS DO CHIP */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-gray-700">
                                            <Smartphone className="w-4 h-4 mr-2 text-blue-400"/>
                                            {row.sim_card_number ? (
                                                <span className="font-mono text-xs">{row.sim_card_number}</span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Sem Chip</span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {row.batch_id && (
                                                <button onClick={() => viewSignedReceipt(row.batch_id)} className="text-purple-600 hover:text-purple-800 text-xs font-bold border border-purple-200 px-3 py-1 rounded hover:bg-purple-50 flex items-center" title="Recibo Coletivo">
                                                    <Eye className="w-3 h-3 mr-1"/> Recibo
                                                </button>
                                            )}
                                            {row.item_id && (
                                                <button onClick={() => downloadTerm(row.item_id, row.student_name)} className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 flex items-center" title="Termo Individual">
                                                    <FileText className="w-3 h-3 mr-1"/> Termo
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default TabletAudit;