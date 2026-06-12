// Utilities condivise dell'app (estratte da App.js - refactoring giugno 2026)

// Smart Backend URL Detection - works in all environments
// PRODUCTION BACKEND: Always use dedicated production backend (always on)
export const getBackendURL = () => {
  // CRITICAL: Always use environment variable when available
  // This is automatically set during Emergent deployments
  const envBackendURL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
  
  if (envBackendURL) {
    console.log('✅ Using environment variable REACT_APP_BACKEND_URL:', envBackendURL);
    return envBackendURL;
  }
  
  // Fallback only for local development when env var is not set
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('💻 Development: Using localhost backend');
    return 'http://localhost:8001';
  }
  
  // Should never reach here in production
  console.error('❌ No backend URL configured! Set REACT_APP_BACKEND_URL environment variable');
  return 'http://localhost:8001';
};

export const BACKEND_URL = getBackendURL();
export const API = `${BACKEND_URL}/api`;

// Costanti globali per i dropdown - accessibili da tutti i componenti
export const PROVINCE_ITALIANE = [
  "AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ",
  "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN",
  "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT",
  "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "VS", "ME", "MI", "MO", "MB", "NA",
  "NO", "NU", "OG", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT",
  "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "SS", "SV", "SI",
  "SR", "SO", "TA", "TE", "TR", "TO", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC",
  "VR", "VV", "VI", "VT"
];

// Log configuration for debugging
console.log('📡 Backend URL configured:', BACKEND_URL);
console.log('📡 API endpoint:', API);

// Helper functions
export const formatDate = (dateString) => {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Date(dateString).toLocaleDateString('it-IT', options);
};

// Helper function per normalizzare i nomi delle province (gestisce varianti come "Monza e Brianza" vs "Monza della Brianza")
export const normalizeProvinceName = (name) => {
  if (!name) return '';
  // Converti in minuscolo e rimuovi spazi extra
  let normalized = name.toLowerCase().trim();
  // Mappa delle varianti comuni
  const provinceAliases = {
    'monza della brianza': 'monza e brianza',
    'monza e della brianza': 'monza e brianza',
    'monza della brienza': 'monza e brianza',  // typo variant
    'monza e brienza': 'monza e brianza',  // typo variant
    'monza-brianza': 'monza e brianza',
    'monza brianza': 'monza e brianza',
    'mb': 'monza e brianza',
    'provincia di monza e brianza': 'monza e brianza',
    'provincia di monza e della brianza': 'monza e brianza',
    'reggio nell\'emilia': 'reggio emilia',
    'reggio nell emilia': 'reggio emilia',
    'reggio-emilia': 'reggio emilia',
    're': 'reggio emilia',
    'forli-cesena': 'forlì-cesena',
    'forli cesena': 'forlì-cesena',
    'verbano cusio ossola': 'verbano-cusio-ossola',
    'vco': 'verbano-cusio-ossola',
    'pesaro urbino': 'pesaro e urbino',
    'pesaro-urbino': 'pesaro e urbino',
    'barletta andria trani': 'barletta-andria-trani',
    'bat': 'barletta-andria-trani',
    'sud sardegna': 'sud sardegna',
    'massa carrara': 'massa-carrara',
    'massa e carrara': 'massa-carrara',
  };
  
  // Check exact match first
  if (provinceAliases[normalized]) {
    return provinceAliases[normalized];
  }
  
  // Check if contains "monza" - normalize all Monza variants
  if (normalized.includes('monza')) {
    return 'monza e brianza';
  }
  
  return normalized;
};

// Helper function per verificare se una provincia corrisponde (con normalizzazione)
export const provinciaMatches = (agentProvinces, leadProvincia) => {
  if (!agentProvinces || agentProvinces.length === 0) return true; // Agente copre tutte le province
  if (!leadProvincia) return true; // Lead senza provincia, mostra tutti gli agenti
  
  const normalizedLeadProvincia = normalizeProvinceName(leadProvincia);
  return agentProvinces.some(p => normalizeProvinceName(p) === normalizedLeadProvincia);
};

// Helper function per formattare gli status dei clienti
export const formatClienteStatus = (status) => {
  const statusMapping = {
    'inserito': 'Inserito',
    'ko': 'KO',
    'infoline': 'Infoline',
    'inviata_consumer': 'Inviata Consumer',
    'problematiche_inserimento': 'Problematiche Inserimento',
    'attesa_documenti_clienti': 'Attesa Documenti Clienti',
    'non_acquisibile_richiesta_escalation': 'Non Acquisibile Richiesta Escalation',
    'in_gestione_struttura_consulente': 'In Gestione Struttura/Consulente',
    'non_risponde': 'Non Risponde',
    'passata_al_bo': 'Passata al BO',
    'da_inserire': 'Da Inserire',
    'inserito_sotto_altro_canale': 'Inserito Sotto Altro Canale',
    'proveniente_da_altro_canale': 'Proveniente da Altro Canale',
    'scontrinare': 'Scontrinare'
  };
  
  return statusMapping[status] || status?.replace('_', ' ').toUpperCase() || 'Non specificato';
};

// Helper function per il colore degli status
export const getClienteStatusVariant = (status) => {
  switch(status) {
    case 'inserito':
    case 'inviata_consumer':
      return 'default';
    case 'ko':
    case 'problematiche_inserimento':
    case 'non_acquisibile_richiesta_escalation':
      return 'destructive';
    case 'infoline':
    case 'in_gestione_struttura_consulente':
      return 'secondary';
    case 'da_inserire':
    case 'attesa_documenti_clienti':
      return 'outline';
    default:
      return 'secondary';
  }
};


export const STATUS_CLIENTI = [
  { value: 'inserito', label: 'Inserito' },
  { value: 'ko', label: 'KO' },
  { value: 'infoline', label: 'Infoline' },
  { value: 'inviata_consumer', label: 'Inviata Consumer' },
  { value: 'problematiche_inserimento', label: 'Problematiche Inserimento' },
  { value: 'attesa_documenti_clienti', label: 'Attesa Documenti Clienti' },
  { value: 'non_acquisibile_richiesta_escalation', label: 'Non Acquisibile - Richiesta Escalation' },
  { value: 'in_gestione_struttura_consulente', label: 'In Gestione Struttura Consulente' },
  { value: 'non_risponde', label: 'Non Risponde' },
  { value: 'passata_al_bo', label: 'Passata al BO' },
  { value: 'da_inserire', label: 'Da Inserire' },
  { value: 'inserito_sotto_altro_canale', label: 'Inserito Sotto Altro Canale' },
  { value: 'proveniente_da_altro_canale', label: 'Proveniente da Altro Canale' },
  { value: 'scontrinare', label: 'Scontrinare' }
];

