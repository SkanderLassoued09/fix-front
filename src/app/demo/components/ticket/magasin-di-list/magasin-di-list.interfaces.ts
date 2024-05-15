export interface GetAllMagasinQueryResponse {
    getDiForMagasin: {
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
            array_composants: {
                nameComposant: string;
                quantity: number;
            }[];
        }[];
        totalDiCount: number;
    };
}

export interface ComposantByNameQueryResponse {
    findOneComposant: {
        _id: string;
        name: string;
        package: string;
        category_composant_id: string;
        prix_achat: number;
        prix_vente: number;
        coming_date: string;
        link: string;
        quantity_stocked: number;
        pdf: string;
        status: string;
    };
}

export interface UpdateComposantMutationResponse {
    _id: string;
    name: string;
    package: string;
    category_composant_id: string;
    prix_achat: number;
    prix_vente: number;
    coming_date: string;
    link: string;
    quantity_stocked: number;
    pdf: string;
    status: string;
}
