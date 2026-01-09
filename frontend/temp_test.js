import React from 'react';
const TestComponent = () => {
return (
                    )}
                    {filters.assigned_agent_id && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        👤 {filters.assigned_agent_id === "unassigned" ? "Non assegnati" : users.find(u => u.id === filters.assigned_agent_id)?.username}
                      </span>
                    )}
                    {filters.date_from && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📅 Da: {filters.date_from}
                      </span>
                    )}
                    {filters.date_to && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📅 A: {filters.date_to}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Caricamento...</div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Lead</TableHead>
                      <TableHead>Nome</TableHead>
                      {/* Colonna Unit - Solo per Admin */}
                      {user?.role === "admin" && (
                        <TableHead>Unit</TableHead>
                      )}
                      <TableHead>Provincia</TableHead>
                      <TableHead>Campagna</TableHead>
                      {/* Colonna Assegnato a - Solo per Admin e Referente */}
                      {(user?.role === "admin" || user?.role === "referente") && (
                        <TableHead>Assegnato a</TableHead>
                      )}
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Azioni</TableHead>
);
};
