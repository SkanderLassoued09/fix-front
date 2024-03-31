export interface DiListTech {
    _id: string;
    _idDi: string;
    id_tech_diag: string;
    id_tech_rep: string;
}

export interface DiListTechQueryResult {
    getDiForTech: DiListTech[];
}

export interface ConfigDiagAffectationMutationResult {
    createStat: {
        _idDi: string;
        messageNotification: string;
    };
}

export interface ConfigRepAffectationMutationResult {
    affectForDiag: boolean;
}
