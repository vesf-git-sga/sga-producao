import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Calendar, AlertTriangle, CheckCircle, TrendingUp, Box } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Area } from 'recharts';

interface ProjectionData {
    totalMeta: number;
    totalDelivered: number;
    remaining: number;
    availableStock: number;
    velocity: number;
    weeklyVelocity: number;
    projectedDate: string | null;
    targetDeadline: string;
    chartData: any[];
}

export const DeliveryProjectionView = ({ API_URL }: { API_URL: string }) => {
    const [data, setData] = useState<ProjectionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjection = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/analytics/tablet-projection`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (e) {
                console.error('Erro ao carregar projeção', e);
            } finally {
                setLoading(false);
            }
        };
        fetchProjection();
    }, [API_URL]);

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Calculando Inteligência Preditiva...</div>;
    if (!data) return null;

    const isDelayed = data.projectedDate && new Date(data.projectedDate) > new Date(data.targetDeadline);
    const stockRupture = data.availableStock < data.remaining;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-extrabold text-blue-900 flex items-center">
                <TrendingUp className="w-6 h-6 mr-3 text-blue-600" />
                Inteligência Preditiva e Run Rate
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* VELOCIDADE ATUAL (Focada em Dia Útil) */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-500 uppercase text-xs">Desempenho da Equipe</h3>
                        <Activity className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-4xl font-black text-blue-700">{data.velocity}</div>
                    <p className="text-sm text-gray-500 font-bold uppercase mt-1">Tablets por dia útil</p>
                    <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">
                        Cálculo baseado nos dias efetivamente trabalhados (ignora feriados). <br/>
                        <span className="font-bold text-gray-700">Projeção p/ 5 dias: {data.weeklyVelocity} semanais.</span>
                    </div>
                </div>

                {/* PREVISÃO DE CONCLUSÃO */}
                <div className={`border rounded-xl p-5 shadow-sm ${isDelayed ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold uppercase text-xs ${isDelayed ? 'text-red-700' : 'text-green-700'}`}>
                            Conclusão Estimada
                        </h3>
                        <Calendar className={`w-5 h-5 ${isDelayed ? 'text-red-500' : 'text-green-500'}`} />
                    </div>
                    <div className={`text-3xl font-black ${isDelayed ? 'text-red-900' : 'text-green-900'}`}>
                        {data.projectedDate ? new Date(data.projectedDate).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                    <p className={`text-sm font-bold mt-1 ${isDelayed ? 'text-red-600' : 'text-green-600'}`}>
                        {isDelayed ? '⚠️ Risco de atraso perante a meta.' : '✅ Dentro do prazo estabelecido.'}
                    </p>
                    <div className={`mt-4 pt-3 border-t text-xs font-medium ${isDelayed ? 'border-red-100 text-red-500' : 'border-green-100 text-green-600'}`}>
                        Alvo da Gestão: {new Date(data.targetDeadline).toLocaleDateString('pt-BR')}
                    </div>
                </div>

                {/* ALERTA DE ESTOQUE */}
                <div className={`border rounded-xl p-5 shadow-sm ${stockRupture ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold uppercase text-xs ${stockRupture ? 'text-orange-700' : 'text-gray-500'}`}>
                            Saúde do Estoque
                        </h3>
                        <Box className={`w-5 h-5 ${stockRupture ? 'text-orange-500' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-3xl font-black text-gray-800">{data.availableStock} <span className="text-lg text-gray-500 font-medium">disp.</span></div>
                    <p className="text-sm text-gray-600 font-medium mt-1">
                        Faltam entregar: <span className="font-bold">{data.remaining}</span>
                    </p>
                    {stockRupture ? (
                        <div className="mt-3 pt-2 border-t border-orange-200 text-xs font-bold text-orange-700 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />
                            Ruptura Preditiva! Faltam {data.remaining - data.availableStock} tablets.
                        </div>
                    ) : (
                        <div className="mt-3 pt-2 border-t border-gray-100 text-xs font-bold text-green-600 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Estoque cobre a demanda restante.
                        </div>
                    )}
                </div>
            </div>

            {/* GRÁFICO BURN-UP */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 text-lg">Curva de Progresso (Entregas Reais vs. Projeção Matemática)</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data.chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                            
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                formatter={(value: number, name: string) => [value, name === 'realizado' ? 'Entregas Reais' : 'Projeção Estimada']}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            <Area type="monotone" dataKey="realizado" fill="#e0f2fe" stroke="none" />
                            <Line type="monotone" dataKey="realizado" name="Entregas Reais Acumuladas" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="projetado" name="Projeção (Baseada no Run Rate)" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />

                            <ReferenceLine y={data.totalMeta} label={{ position: 'insideTopLeft', value: `Alvo: ${data.totalMeta} alunos`, fill: '#dc2626', fontSize: 12, fontWeight: 'bold' }} stroke="#dc2626" strokeDasharray="3 3" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};