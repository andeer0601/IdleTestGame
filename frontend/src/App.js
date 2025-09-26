import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import { useRef } from 'react';
import axios from 'axios';
import './App.css';

// Game API functions
const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const gameAPI = {
  createPlayer: async () => {
    const response = await axios.post(`${API_BASE}/api/player/create`);
    return response.data.player_id;
  },
  
  getGameState: async (playerId) => {
    const response = await axios.get(`${API_BASE}/api/player/${playerId}/state`);
    return response.data;
  },
  
  buildHouse: async (playerId) => {
    const response = await axios.post(`${API_BASE}/api/player/${playerId}/build-house`);
    return response.data;
  },
  
  buyUpgrade: async (playerId, upgradeId) => {
    const response = await axios.post(`${API_BASE}/api/player/${playerId}/buy-upgrade?upgrade_id=${upgradeId}`);
    return response.data;
  },
  
  getMaterials: async () => {
    const response = await axios.get(`${API_BASE}/api/materials`);
    return response.data;
  },
  
  getUpgrades: async () => {
    const response = await axios.get(`${API_BASE}/api/upgrades`);
    return response.data;
  },
  
  getPlanets: async () => {
    const response = await axios.get(`${API_BASE}/api/planets`);
    return response.data;
  },
  
  unlockPlanet: async (playerId, planetId) => {
    const response = await axios.post(`${API_BASE}/api/player/${playerId}/unlock-planet?planet_id=${planetId}`);
    return response.data;
  }
};

// 3D Components
function Room3D({ roomType, onInteract }) {
  const meshRef = useRef();
  
  const getRoomColor = () => {
    switch(roomType) {
      case 'factory': return '#00d4ff';
      case 'control': return '#7b2cbf';
      case 'planets': return '#06ffa5';
      default: return '#ffffff';
    }
  };
  
  const getRoomElements = () => {
    switch(roomType) {
      case 'factory':
        return (
          <>
            <Box ref={meshRef} args={[2, 1, 1]} position={[0, 0, 0]} onClick={() => onInteract('factory')}>
              <meshStandardMaterial color={getRoomColor()} />
            </Box>
            <Text position={[0, 1.5, 0]} fontSize={0.3} color="white">
              Central de Produção
            </Text>
            <Text position={[0, -1.5, 0]} fontSize={0.2} color="gray">
              Clique para acessar
            </Text>
          </>
        );
      case 'control':
        return (
          <>
            <Sphere ref={meshRef} args={[1, 32, 32]} position={[4, 0, 0]} onClick={() => onInteract('control')}>
              <meshStandardMaterial color={getRoomColor()} wireframe />
            </Sphere>
            <Text position={[4, 1.5, 0]} fontSize={0.3} color="white">
              Centro de Controle
            </Text>
            <Text position={[4, -1.5, 0]} fontSize={0.2} color="gray">
              Melhorias e Upgrades
            </Text>
          </>
        );
      case 'planets':
        return (
          <>
            <Box ref={meshRef} args={[1.5, 1.5, 1.5]} position={[-4, 0, 0]} onClick={() => onInteract('planets')}>
              <meshStandardMaterial color={getRoomColor()} />
            </Box>
            <Text position={[-4, 1.5, 0]} fontSize={0.3} color="white">
              Estações Planetárias
            </Text>
            <Text position={[-4, -1.5, 0]} fontSize={0.2} color="gray">
              Mineração e Materiais
            </Text>
          </>
        );
      default:
        return null;
    }
  };
  
  return getRoomElements();
}

function GameScene({ currentRoom, onRoomChange }) {
  return (
    <Canvas camera={{ position: [0, 2, 8] }} style={{ height: '60vh' }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <pointLight position={[-10, -10, -5]} color="#7b2cbf" />
      
      <Room3D roomType="factory" onInteract={onRoomChange} />
      <Room3D roomType="control" onInteract={onRoomChange} />
      <Room3D roomType="planets" onInteract={onRoomChange} />
      
      <OrbitControls enableZoom={true} enablePan={true} />
    </Canvas>
  );
}

// UI Components
function GameStats({ gameState, materials }) {
  if (!gameState) return null;
  
  return (
    <div className="bg-cyber-dark/80 backdrop-blur-sm border border-cyber-blue/30 rounded-lg p-4 mb-4">
      <h3 className="text-cyber-blue text-lg font-bold mb-2 glow-text">Status da Empresa</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-gray-300 text-sm">Dinheiro</p>
          <p className="text-cyber-green text-xl font-bold">₢{Math.floor(gameState.money).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-300 text-sm">Casas Construídas</p>
          <p className="text-cyber-blue text-xl font-bold">{gameState.houses_built.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-300 text-sm">Material Atual</p>
          <p className="text-cyber-purple text-lg">{materials[gameState.current_material]?.name || gameState.current_material}</p>
        </div>
        <div>
          <p className="text-gray-300 text-sm">Planetas Desbloqueados</p>
          <p className="text-cyber-green text-lg">{gameState.unlocked_planets?.length || 1}</p>
        </div>
      </div>
    </div>
  );
}

function FactoryRoom({ gameState, onBuildHouse, materials, onClose }) {
  const [isBuilding, setIsBuilding] = useState(false);
  
  const handleBuild = async () => {
    setIsBuilding(true);
    try {
      await onBuildHouse();
    } catch (error) {
      console.error('Erro ao construir casa:', error);
    }
    setIsBuilding(false);
  };
  
  const currentMaterial = materials[gameState.current_material];
  const materialQuantity = gameState.materials?.[gameState.current_material] || 0;
  const houseValue = Math.floor(10 * (currentMaterial?.cost_multiplier || 1));
  
  return (
    <div className="bg-cyber-darker/90 backdrop-blur-sm border border-cyber-blue/50 rounded-lg p-6 slide-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-cyber-blue glow-text">Central de Produção</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ✕
        </button>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyber-green">Produção Manual</h3>
          <div className="bg-cyber-dark/50 p-4 rounded-lg">
            <p className="text-gray-300 mb-2">Material: {currentMaterial?.name}</p>
            <p className="text-gray-300 mb-2">Estoque: {Math.floor(materialQuantity)} unidades</p>
            <p className="text-cyber-green mb-4">Valor por casa: ₢{houseValue}</p>
            
            <button
              onClick={handleBuild}
              disabled={isBuilding || materialQuantity < 1}
              className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 ${
                materialQuantity >= 1 
                  ? 'bg-cyber-blue hover:bg-cyber-blue/80 text-white pulse-glow' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isBuilding ? 'Construindo...' : 'Construir Casa'}
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyber-purple">Linha de Produção</h3>
          <div className="bg-cyber-dark/50 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Eficiência</span>
                <span className="text-cyber-blue">100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Velocidade</span>
                <span className="text-cyber-green">Normal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Status</span>
                <span className="text-cyber-purple">Operacional</span>
              </div>
            </div>
          </div>
          
          <div className="bg-cyber-dark/50 p-4 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Próximos materiais disponíveis:</p>
            {Object.entries(materials).map(([id, material]) => (
              <div key={id} className="text-sm text-gray-300">
                {material.name} - {material.planet_source}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlRoom({ gameState, upgrades, onBuyUpgrade, onClose }) {
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  
  const getUpgradeLevel = (upgradeId) => {
    const upgrade = gameState.upgrades?.find(u => u.upgrade_id === upgradeId);
    return upgrade ? upgrade.level : 0;
  };
  
  const getUpgradeCost = (upgradeId) => {
    const baseData = upgrades[upgradeId];
    const currentLevel = getUpgradeLevel(upgradeId);
    return Math.floor(baseData.base_cost * (1.5 ** currentLevel));
  };
  
  return (
    <div className="bg-cyber-darker/90 backdrop-blur-sm border border-cyber-purple/50 rounded-lg p-6 slide-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-cyber-purple glow-text">Centro de Controle</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ✕
        </button>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-cyber-blue mb-4">Melhorias Disponíveis</h3>
          <div className="space-y-3">
            {Object.entries(upgrades).map(([id, upgrade]) => {
              const level = getUpgradeLevel(id);
              const cost = getUpgradeCost(id);
              const canAfford = gameState.money >= cost;
              
              return (
                <div key={id} className="bg-cyber-dark/50 p-4 rounded-lg border border-gray-600 hover:border-cyber-blue/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-cyber-green font-semibold">{upgrade.name}</h4>
                    <span className="text-cyber-blue text-sm">Nível {level}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">{upgrade.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-cyber-purple font-bold">₢{cost.toLocaleString()}</span>
                    <button
                      onClick={() => canAfford && onBuyUpgrade(id)}
                      disabled={!canAfford}
                      className={`px-4 py-2 rounded font-bold text-sm transition-all duration-300 ${
                        canAfford 
                          ? 'bg-cyber-green hover:bg-cyber-green/80 text-cyber-dark' 
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? 'Comprar' : 'Sem fundos'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-cyber-green mb-4">Status dos Sistemas</h3>
          <div className="space-y-3">
            {gameState.upgrades?.map((upgrade, index) => {
              const upgradeData = upgrades[upgrade.upgrade_id];
              return (
                <div key={index} className="bg-cyber-dark/50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-300">{upgradeData?.name}</span>
                    <span className="text-cyber-blue">Nível {upgrade.level}</span>
                  </div>
                </div>
              );
            })}
            
            {!gameState.upgrades?.length && (
              <p className="text-gray-500 italic">Nenhuma melhoria adquirida ainda</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanetsRoom({ gameState, planets, materials, onUnlockPlanet, onClose }) {
  return (
    <div className="bg-cyber-darker/90 backdrop-blur-sm border border-cyber-green/50 rounded-lg p-6 slide-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-cyber-green glow-text">Estações Planetárias</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ✕
        </button>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-cyber-blue mb-4">Planetas Disponíveis</h3>
          <div className="space-y-3">
            {Object.entries(planets).map(([id, planet]) => {
              const isUnlocked = gameState.unlocked_planets?.includes(id);
              const canAfford = gameState.money >= planet.unlock_cost;
              
              return (
                <div key={id} className={`p-4 rounded-lg border transition-colors ${
                  isUnlocked 
                    ? 'bg-cyber-green/20 border-cyber-green/50' 
                    : 'bg-cyber-dark/50 border-gray-600 hover:border-cyber-green/50'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-cyber-green font-semibold">{planet.name}</h4>
                    <span className="text-xs text-gray-400">{planet.distance > 1000 ? `${planet.distance} anos-luz` : `${planet.distance.toLocaleString()} km`}</span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-gray-300 text-sm mb-1">Materiais disponíveis:</p>
                    {planet.materials.map(materialId => (
                      <span key={materialId} className="inline-block bg-cyber-purple/30 text-cyber-purple px-2 py-1 rounded text-xs mr-1">
                        {materials[materialId]?.name}
                      </span>
                    ))}
                  </div>
                  
                  {isUnlocked ? (
                    <div className="flex justify-between items-center">
                      <span className="text-cyber-green font-bold">✓ Desbloqueado</span>
                      <span className="text-gray-400 text-sm">Estação Ativa</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-cyber-blue font-bold">₢{planet.unlock_cost.toLocaleString()}</span>
                      <button
                        onClick={() => canAfford && onUnlockPlanet(id)}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded font-bold text-sm transition-all duration-300 ${
                          canAfford 
                            ? 'bg-cyber-green hover:bg-cyber-green/80 text-cyber-dark' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'Desbloquear' : 'Sem fundos'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-cyber-purple mb-4">Materiais no Estoque</h3>
          <div className="space-y-3">
            {Object.entries(gameState.materials || {}).map(([materialId, quantity]) => {
              const material = materials[materialId];
              return (
                <div key={materialId} className="bg-cyber-dark/50 p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-cyber-green font-semibold">{material?.name}</span>
                    <p className="text-gray-400 text-sm">Origem: {material?.planet_source}</p>
                  </div>
                  <span className="text-cyber-blue font-bold">{Math.floor(quantity)} un.</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [playerId, setPlayerId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [materials, setMaterials] = useState({});
  const [upgrades, setUpgrades] = useState({});
  const [planets, setPlanets] = useState({});
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize game
  useEffect(() => {
    initializeGame();
  }, []);

  // Auto-refresh game state
  useEffect(() => {
    if (playerId) {
      const interval = setInterval(() => {
        refreshGameState();
      }, 5000); // Update every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [playerId]);

  const initializeGame = async () => {
    try {
      setLoading(true);
      
      // Get static data
      const [materialsData, upgradesData, planetsData] = await Promise.all([
        gameAPI.getMaterials(),
        gameAPI.getUpgrades(),
        gameAPI.getPlanets()
      ]);
      
      setMaterials(materialsData);
      setUpgrades(upgradesData);
      setPlanets(planetsData);
      
      // Check for existing player or create new one
      let savedPlayerId = localStorage.getItem('playerId');
      if (!savedPlayerId) {
        savedPlayerId = await gameAPI.createPlayer();
        localStorage.setItem('playerId', savedPlayerId);
      }
      
      setPlayerId(savedPlayerId);
      await refreshGameState(savedPlayerId);
      
    } catch (err) {
      console.error('Erro ao inicializar o jogo:', err);
      setError('Falha ao carregar o jogo. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const refreshGameState = async (pid = playerId) => {
    if (!pid) return;
    
    try {
      const state = await gameAPI.getGameState(pid);
      setGameState(state);
      setError(null);
    } catch (err) {
      console.error('Erro ao atualizar estado do jogo:', err);
      setError('Erro ao sincronizar com o servidor');
    }
  };

  const handleBuildHouse = async () => {
    try {
      await gameAPI.buildHouse(playerId);
      await refreshGameState();
    } catch (err) {
      console.error('Erro ao construir casa:', err);
      if (err.response?.status === 400) {
        setError('Materiais insuficientes para construção');
      }
    }
  };

  const handleBuyUpgrade = async (upgradeId) => {
    try {
      await gameAPI.buyUpgrade(playerId, upgradeId);
      await refreshGameState();
    } catch (err) {
      console.error('Erro ao comprar upgrade:', err);
      if (err.response?.status === 400) {
        setError('Dinheiro insuficiente para esta melhoria');
      }
    }
  };

  const handleUnlockPlanet = async (planetId) => {
    try {
      await gameAPI.unlockPlanet(playerId, planetId);
      await refreshGameState();
    } catch (err) {
      console.error('Erro ao desbloquear planeta:', err);
      if (err.response?.status === 400) {
        setError('Dinheiro insuficiente para desbloquear este planeta');
      }
    }
  };

  const handleRoomChange = (room) => {
    setCurrentRoom(room);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin-slow w-16 h-16 border-4 border-cyber-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-cyber-blue text-xl glow-text">Inicializando sistemas...</p>
        </div>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button 
            onClick={initializeGame}
            className="bg-cyber-blue hover:bg-cyber-blue/80 text-white px-6 py-3 rounded-lg font-bold"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <header className="text-center mb-6">
          <h1 className="text-4xl md:text-6xl font-bold text-cyber-blue glow-text mb-2 floating">
            Idle House Production
          </h1>
          <p className="text-gray-300 text-lg">
            Construa o império habitacional do futuro através dos cosmos
          </p>
        </header>

        {/* Error display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-400 hover:text-red-200 ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Game Stats */}
        <GameStats gameState={gameState} materials={materials} />

        {/* 3D Scene */}
        {!currentRoom && (
          <div className="bg-cyber-dark/50 backdrop-blur-sm border border-cyber-blue/30 rounded-lg p-4 mb-6">
            <h2 className="text-2xl font-bold text-cyber-blue mb-4 text-center glow-text">
              Central de Comando
            </h2>
            <GameScene currentRoom={currentRoom} onRoomChange={handleRoomChange} />
            <p className="text-center text-gray-400 mt-4">
              Use o mouse para navegar e clique nas estações para acessar
            </p>
          </div>
        )}

        {/* Room UIs */}
        {currentRoom === 'factory' && (
          <FactoryRoom 
            gameState={gameState}
            materials={materials}
            onBuildHouse={handleBuildHouse}
            onClose={() => setCurrentRoom(null)}
          />
        )}

        {currentRoom === 'control' && (
          <ControlRoom 
            gameState={gameState}
            upgrades={upgrades}
            onBuyUpgrade={handleBuyUpgrade}
            onClose={() => setCurrentRoom(null)}
          />
        )}

        {currentRoom === 'planets' && (
          <PlanetsRoom 
            gameState={gameState}
            planets={planets}
            materials={materials}
            onUnlockPlanet={handleUnlockPlanet}
            onClose={() => setCurrentRoom(null)}
          />
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm mt-8">
          <p>Construa. Evolua. Conquiste o universo. 🚀</p>
        </footer>
      </div>
    </div>
  );
}

export default App;