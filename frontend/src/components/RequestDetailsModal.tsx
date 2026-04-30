// frontend/src/components/RequestDetailsModal.tsx -> CÓDIGO FINAL COM DOWNLOAD CORRIGIDO

import React from 'react';
import axios from 'axios';
import { X, Download } from 'lucide-react';
import { useToast } from '../App'; // Importa o hook de notificação

interface RequestDetails {
  id: number;
  reason: string;
  details: string;
  created_at: string;
  patrimonio_number: string;
  brand: string;
  model: string;
  serial_number: string;
  requester_name: string;
  evidence_path: string;
}

interface RequestDetailsModalProps {
  request: RequestDetails;
  onClose: () => void;
  API_URL: string;
}

const RequestDetailsModal = ({ request, onClose, API_URL }: RequestDetailsModalProps) => {
  const { addToast } = useToast(); // Hook para exibir notificações

  // NOVA FUNÇÃO PARA LIDAR COM O DOWNLOAD
  const handleDownload = async () => {
    addToast('Iniciando o download...', 'info');
    try {
      const response = await axios.get(
        `${API_URL}/retirement-requests/${request.id}/download-evidence`,
        {
          responseType: 'blob', // Essencial para o navegador entender que é um arquivo
        }
      );

      // Pega o nome do arquivo do cabeçalho da resposta, se disponível
      const contentDisposition = response.headers['content-disposition'];
      let filename = `evidencia_req_${request.id}.pdf`; // Nome padrão
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch.length > 1) {
          filename = filenameMatch[1];
        }
      }

      // Cria um link temporário na memória para iniciar o download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Limpa o link da memória
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Erro ao baixar evidência:", error);
      addToast('Não foi possível baixar o arquivo.', 'error');
    }
  };


  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Detalhes da Solicitação de Baixa #{request.id}</h2>

        <div className="space-y-4">
          {/* ... (seção de detalhes do ativo não muda) ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 border rounded-md"><span className="font-semibold text-gray-600">Patrimônio:</span> {request.patrimonio_number}</div>
            <div className="bg-gray-50 p-3 border rounded-md"><span className="font-semibold text-gray-600">Ativo:</span> {request.brand} {request.model}</div>
            <div className="bg-gray-50 p-3 border rounded-md"><span className="font-semibold text-gray-600">Solicitante:</span> {request.requester_name}</div>
            <div className="bg-gray-50 p-3 border rounded-md"><span className="font-semibold text-gray-600">Data da Solicitação:</span> {new Date(request.created_at).toLocaleString('pt-BR')}</div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700">Motivo da Solicitação:</h4>
            <p className="p-3 bg-gray-50 border rounded-md">{request.reason}</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-700">Descrição Detalhada:</h4>
            <p className="p-3 bg-gray-50 border rounded-md whitespace-pre-wrap">{request.details || 'Nenhuma descrição fornecida.'}</p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700">Evidência Anexada:</h4>
            {/* A TAG <a> FOI SUBSTITUÍDA POR UM <button> COM onClick */}
            <button 
              type="button"
              onClick={handleDownload}
              className="mt-2 w-full bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-sm hover:bg-blue-200 flex items-center justify-center transition-colors duration-200"
            >
              <Download className="w-5 h-5 mr-2" /> Baixar Arquivo de Evidência
            </button>
          </div>
        </div>

        <div className="flex justify-end mt-8">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;