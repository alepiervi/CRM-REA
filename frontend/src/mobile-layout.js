// Temporary file to store the mobile layout replacement
// This will be used to replace the return statement in Dashboard component

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* 🎯 MOBILE: Mobile Menu Overlay */}
      {isMobile && (
        <>
          <div 
            className={`mobile-nav-overlay ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Mobile Sidebar */}
          <div className={`mobile-sidebar ${isMobileMenuOpen ? 'active' : ''}`}>
            {/* Mobile Header */}
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-800">CRM System</h1>
                    <p className="text-xs text-slate-500">Mobile</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Mobile Selectors - Simplified */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div>
                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Commessa
                  {commesse.length > 0 && (
                    <span className="ml-1 text-xs text-green-600">({commesse.length})</span>
                  )}
                </Label>
                <Select value={selectedCommessa} onValueChange={handleCommessaChange}>
                  <SelectTrigger className="mt-1 mobile-select">
                    <SelectValue placeholder="Seleziona commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le Commesse</SelectItem>
                    {getAvailableCommesse().map((commessa) => (
                      <SelectItem key={commessa.id} value={commessa.id}>
                        <div className="flex items-center space-x-2">
                          <Building className="w-3 h-3" />
                          <span>{commessa.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto p-2">
              {getNavItems().map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors mobile-nav-item ${
                    activeTab === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{user.username}</p>
                  <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                </div>
              </div>
              <Button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                variant="outline"
                size="sm"
                className="w-full text-slate-600 hover:text-red-600 hover:border-red-300 mobile-button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Esci
              </Button>
            </div>
          </div>
        </>
      )}

      {/* 🎯 DESKTOP: Desktop Sidebar (hidden on mobile) */}
      <div className="desktop-sidebar w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col">
        {/* Desktop Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">CRM System</h1>
              <p className="text-xs text-slate-500">Gestione Lead Avanzata</p>
            </div>
          </div>
          
          {/* Desktop Hierarchical Selectors */}
          <div>
            {/* 1. SELETTORE COMMESSA */}
            <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              1. Seleziona Commessa
              {commesse.length > 0 && (
                <span className="ml-1 text-xs text-green-600">({commesse.length} disponibili)</span>
              )}
            </Label>
            <Select value={selectedCommessa} onValueChange={handleCommessaChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona commessa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Commesse</SelectItem>
                {getAvailableCommesse().map((commessa) => (
                  <SelectItem key={commessa.id} value={commessa.id}>
                    <div className="flex items-center space-x-2">
                      <Building className="w-3 h-3" />
                      <span>{commessa.nome}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 2. SELETTORE SERVIZIO */}
            {selectedCommessa && selectedCommessa !== "all" && (
              <div className="mt-4">
                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  2. Seleziona Servizio
                  {servizi.length > 0 && (
                    <span className="ml-1 text-xs text-green-600">({servizi.length})</span>
                  )}
                </Label>
                <Select value={selectedServizio || "all"} onValueChange={handleServizioChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona servizio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i Servizi</SelectItem>
                    {servizi.map((servizio) => (
                      <SelectItem key={servizio.id} value={servizio.id}>
                        <div className="flex items-center space-x-2">
                          <Cog className="w-3 h-3" />
                          <span>{servizio.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 3. SELETTORE TIPOLOGIA CONTRATTO */}
            {selectedCommessa && selectedCommessa !== "all" && 
             selectedServizio && selectedServizio !== "all" && (
              <div className="mt-4">
                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  3. Tipologia Contratto
                  {formTipologieContratto.length > 0 && (
                    <span className="ml-1 text-xs text-green-600">({formTipologieContratto.length})</span>
                  )}
                </Label>
                <Select value={selectedTipologiaContratto} onValueChange={handleTipologiaContrattoChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona tipologia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le Tipologie</SelectItem>
                    {formTipologieContratto.map((tipologia) => (
                      <SelectItem key={tipologia.value} value={tipologia.value}>
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3 h-3" />
                          <span>{tipologia.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 4. SELETTORE UNIT/SUB AGENZIA */}
            {selectedCommessa && selectedCommessa !== "all" && 
             selectedServizio && selectedServizio !== "all" && 
             selectedTipologiaContratto && selectedTipologiaContratto !== "all" && (
              <div className="mt-4">
                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  4. Unit/Sub Agenzia
                  {getAvailableUnitsSubAgenzie().length > 0 && (
                    <span className="ml-1 text-xs text-green-600">({getAvailableUnitsSubAgenzie().length})</span>
                  )}
                </Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le Unit/Sub Agenzie</SelectItem>
                    {getAvailableUnitsSubAgenzie().map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center space-x-2">
                          {item.type === 'unit' ? (
                            <Building2 className="w-3 h-3" />
                          ) : (
                            <Store className="w-3 h-3" />
                          )}
                          <span>{item.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.type === 'unit' ? 'Unit' : 'Sub Agenzia'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop Footer */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 RESPONSIVE: Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 🎯 MOBILE: Mobile Header with Hamburger */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
                className="mobile-menu-button p-2 lg:hidden touch-target"
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              <div>
                <h2 className="text-lg lg:text-xl font-semibold text-slate-800 capitalize">
                  {getNavItems().find(item => item.id === activeTab)?.label || "Dashboard"}
                </h2>
                {selectedUnit && selectedUnit !== "all" && (
                  <Badge variant="outline" className="text-xs mt-1 hidden sm:inline-flex">
                    <Building2 className="w-3 h-3 mr-1" />
                    {units.find(u => u.id === selectedUnit)?.name}
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Desktop Logout Button */}
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="text-slate-600 hover:text-red-600 hover:border-red-300 hidden md:flex"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
            
            {/* Mobile User Info */}
            <div className="flex items-center space-x-2 md:hidden">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-800 truncate max-w-24">{user.username}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* 🎯 RESPONSIVE: Page Content */}
        <main className="flex-1 overflow-y-auto mobile-container p-3 md:p-6">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );