export interface Di {
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
}

export interface DiQueryResult {
    getAllDi: {
        di: Di[];
        totalDiCount: number;
    };
}

export interface CreateDiInput {
    title: string;
    designiation: string;
    typeClient: string;
    status: string;
    client_id: string;
    company_id: string;
    nSerie: string;
}

export interface CreateDiMutationResult {
    createDi: {
        _id: string;
    };
}

export interface Company {
    _id: string;
    name: string;
}

export interface GetCompaniesQueryResult {
    getAllComapnyforDropDown: Company[];
}

export interface Client {
    _id: string;
    first_name: string;
    last_name: string;
}

export interface GetClientsQueryResult {
    getAllClient: Client[];
}
