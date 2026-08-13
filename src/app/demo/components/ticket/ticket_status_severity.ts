function getSeverityDemandeIntervention(status: string) {
    switch (status) {
        case 'CREATED':
            return 'success';
        case 'PENDING1':
        case 'PENDING2':
        case 'PENDING3':
            return 'help';
        case 'DIAGNOSTIC':
        case 'INDIAGNOSTIC':
            return 'info';
        case 'CONFIRMATION':
        case 'PROCESSING':
        case 'MAGASIN_FINALISATION':
        case 'ATTENTE_CONFIRMATION_COORDINATION':
        case 'MagasinEstimation':
            return 'warning';
        case 'PRICING':
        case 'PRICING_DIAG':
            return 'warning';
        case 'WAITING_DEVIS':
        case 'WAITING_BC':
        case 'NEGOTIATION1':
        case 'ATTENTE_BC_DEVIS':
        case 'NEGOTIATION2':
            return 'warning';
        case 'REPARATION':
        case 'INREPARATION':
            return 'info';
        case 'WAITING_BL':
        case 'WAITING_FACTURE':
        case 'CLOSING':
        case 'ATTENTE_BL_FACTURE':
            return 'warning';
        case 'FINISHED':
            return 'success';
        case 'ANNULER':
            return 'contrast';
        case 'RETOUR1':
        case 'RETOUR2':
        case 'RETOUR3':
            return 'danger';
        default:
            return 'warn';
    }
}
