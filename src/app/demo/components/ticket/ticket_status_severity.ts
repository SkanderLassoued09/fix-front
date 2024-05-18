function getSeverityDemandeIntervention(status: string) {
    console.log('🍛DI => [status]:', status);
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
        case 'INMAGASIN':
        case 'MagasinEstimation':
            return 'warning';
        case 'PRICING':
            return 'warning';
        case 'NEGOTIATION1':
        case 'NEGOTIATION2':
            return 'warning';
        case 'REPARATION':
        case 'INREPARATION':
            return 'info';
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
