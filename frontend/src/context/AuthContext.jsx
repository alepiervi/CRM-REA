// Auth Context (estratto da App.js - refactoring giugno 2026)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useToast } from "../hooks/use-toast";
import { API } from "../lib/appUtils";

// Auth Context
export const AuthContext = React.createContext();

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const { toast } = useToast(); // Add toast hook
  // REDESIGNED: Single-timer session management state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const sessionTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // REDESIGNED: Single-timer session management system
  const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes total
  const WARNING_TIME = 2 * 60 * 1000;     // Show warning 2 minutes before timeout

  const checkSessionTimeout = () => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;
    const timeRemaining = SESSION_TIMEOUT - timeSinceActivity;

    console.log(`🕐 Session check: ${Math.floor(timeRemaining / 1000)}s remaining`);

    // DEFENSIVE CHECK: Don't logout if session extension just happened (within last 5 seconds)
    if (timeSinceActivity < 5000) {
      console.log('✅ Recent activity detected - session is active');
      if (showSessionWarning) {
        console.log('✅ Hiding session warning due to recent activity');
        setShowSessionWarning(false);
        stopCountdown();
      }
      return;
    }

    if (timeRemaining <= 0) {
      // Session expired - logout
      console.log('🚪 Session expired - logging out');
      clearSessionTimers();
      setShowSessionWarning(false);
      showSessionWarningToast('⏰ Sessione scaduta per inattività', 'destructive');
      setTimeout(logout, 1000);
      return;
    }

    if (timeRemaining <= WARNING_TIME && !showSessionWarning) {
      // Show warning banner and start countdown
      console.log(`⚠️ Showing session warning: ${Math.floor(timeRemaining / 1000)}s left`);
      setShowSessionWarning(true);
      setTimeLeft(Math.ceil(timeRemaining / 1000));
      showSessionWarningToast('⚠️ La sessione scadrà tra 2 minuti', 'default');
      startCountdown();
    } else if (timeRemaining > WARNING_TIME && showSessionWarning) {
      // Hide warning if activity detected
      console.log('✅ Activity detected - hiding session warning');
      setShowSessionWarning(false);
      stopCountdown();
    }
  };

  const clearSessionTimers = () => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startSessionTimer = () => {
    clearSessionTimers();
    
    // Update last activity
    lastActivityRef.current = Date.now();
    
    // Check session every 5 seconds
    sessionTimerRef.current = setInterval(checkSessionTimeout, 5000);
  };

  const showSessionWarningToast = (message, variant = 'default') => {
    try {
      toast({
        title: "⏰ Avviso Sessione",
        description: message,
        variant: variant,
        duration: 8000
      });
    } catch (error) {
      console.log('Toast error:', error, 'Message:', message);
    }
  };

  const startCountdown = () => {
    console.log('▶️ Starting countdown');
    stopCountdown();
    
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        const newTime = prevTime - 1;
        
        if (newTime <= 0) {
          console.log('⏰ Countdown reached 0 - checking session');
          stopCountdown();
          checkSessionTimeout(); // This will handle logout if needed
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const extendSession = async () => {
    console.log('🔄 Extending session - STOPPING COUNTDOWN IMMEDIATELY');
    
    // CRITICAL FIX: Stop countdown and update activity BEFORE API call to prevent race condition
    stopCountdown();
    setShowSessionWarning(false);
    lastActivityRef.current = Date.now();
    
    try {
      // Validate JWT token
      console.log('🔑 Validating JWT token...');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || ''}/api/auth/me`);
      
      if (response.data && response.data.username && response.data.id) {
        console.log('✅ Session extended successfully');
        
        // Update user data if needed
        setUser(response.data);
        
        showSessionWarningToast('✅ Sessione estesa per altri 15 minuti', 'default');
        
        console.log('✅ Session successfully extended with race condition fix');
      } else {
        throw new Error('Invalid response from auth/me endpoint');
      }
      
    } catch (error) {
      console.error('❌ Session extension failed:', error);
      showSessionWarningToast('⏰ Sessione scaduta - richiesto nuovo login', 'destructive');
      setTimeout(logout, 1000);
    }
  };

  // resetActivityTimer removed - using handleActivity directly in useEffect

  // REDESIGNED: Activity detection system
  useEffect(() => {
    if (!token || !user) return;

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    
    let throttleTimeout = null;
    
    const handleActivity = () => {
      // Throttle activity detection to prevent excessive calls
      if (throttleTimeout) return;
      
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000);
      
      console.log('🎯 Activity detected');
      
      // Update last activity time
      lastActivityRef.current = Date.now();
      
      // If warning is showing, hide it (user is active)
      if (showSessionWarning) {
        console.log('✅ Hiding session warning due to activity');
        setShowSessionWarning(false);
        stopCountdown();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start session timer
    startSessionTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearSessionTimers();
    };
  }, [token, user]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Simplified axios interceptor - only logout on critical auth failures
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only logout on critical authentication failures, not during session operations
        if (error.response?.status === 401 && 
            !error.config?.url?.includes('/auth/me')) {
          console.log('🚪 Critical auth failure - logging out');
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user:", error);
      // Se il token è scaduto o non valido, rimuovi tutto e forza login
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Validazione input
      if (!username || !password) {
        return { 
          success: false, 
          error: "Username e password sono obbligatori" 
        };
      }

      const response = await axios.post(`${API}/auth/login`, {
        username,
        password,
      });
      
      const { access_token, user: userData } = response.data;
      
      // Validazione risposta
      if (!access_token || !userData) {
        return { 
          success: false, 
          error: "Risposta del server non valida" 
        };
      }
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem("token", access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      // Check if user needs to change password
      if (userData.password_change_required) {
        setShowPasswordChangeModal(true);
        toast({
          title: "⚠️ Cambio Password Richiesto", 
          description: "Devi cambiare la password al primo accesso per motivi di sicurezza.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ Login effettuato con successo", 
          description: `Benvenuto/a, ${userData.username}!`,
          variant: "default"
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      
      let errorMessage = "Errore durante il login";
      
      if (error.response) {
        // Errori dal server
        switch (error.response.status) {
          case 401:
            errorMessage = "Username o password non validi";
            break;
          case 403:
            errorMessage = "Account non autorizzato";
            break;
          case 500:
            errorMessage = "Errore interno del server";
            break;
          default:
            errorMessage = error.response.data?.detail || "Errore di autenticazione";
        }
      } else if (error.request) {
        // Errori di rete
        errorMessage = "Impossibile connettersi al server";
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };

  // REDESIGNED: Clear timers on logout
  const logout = () => {
    console.log('🚪 Logging out user');
    
    // Clear redesigned session timers
    clearSessionTimers();
    
    // Hide any session warnings
    setShowSessionWarning(false);
    
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    
    // Force page reload to ensure clean state
    window.location.reload();
  };

  const checkAuth = async () => {
    if (!token) return false;
    
    try {
      await axios.get(`${API}/auth/me`);
      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      // Update user data to reflect password change
      const updatedUser = { ...user, password_change_required: false };
      setUser(updatedUser);
      setShowPasswordChangeModal(false);
      
      toast({
        title: "✅ Password cambiata con successo",
        description: "La tua password è stata aggiornata.",
        variant: "default"
      });
      
      return { success: true };
    } catch (error) {
      toast({
        title: "❌ Errore cambio password",
        description: error.response?.data?.detail || "Errore durante il cambio password",
        variant: "destructive"
      });
      return { success: false };
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading, 
        login, 
        logout, 
        checkAuth,
        showSessionWarning: showSessionWarning || false,
        timeLeft: timeLeft || 0,
        extendSession: extendSession || (() => {}),
        stopCountdown: stopCountdown || (() => {}),
        showPasswordChangeModal,
        setShowPasswordChangeModal,
        changePassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Password Change Modal Component
