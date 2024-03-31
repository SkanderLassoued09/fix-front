export interface TechStartDiagnosticMutationResponse {
    tech_startDiagnostic: {
        _id: string;
    };
}

export interface GetAllTechQueryResponse {
    getAllTech: {
        _id: string;
        firstName: string;
        lastName: string;
    }[];
}

export interface ConfigDiagAffectationMutationResponse {
    createStat: {
        _idDi: string;
        messageNotification: string;
    };
}

export interface GetAllDiForCoordinatorQueryResponse {
    get_coordinatorDI: {
        di: {
            _id: string;
            title: string;
            description: string;
            can_be_repaired: boolean;
            bon_de_commande: string;
            bon_de_livraison: string;
            contain_pdr: boolean;
            status: string;
            createdAt: string;
            updatedAt: string;
            current_roles: string[];
            client_id: string;
            remarque_id: string;
            createdBy: string;
            location_id: string;
            di_category_id: string;
        };
        totalDiCount: number;
    };
}

export interface ConfigRepAffectationMutationResponse {
    affectForDiag: string;
}
