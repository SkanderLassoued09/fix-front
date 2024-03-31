export interface Column {
    field: string;
    header: string;
}

export interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

export interface ProfileAddMutationResponse {
    createProfile: {
        _id: string;
    };
}

export interface AllProfileQueryResponse {
    getAllProfiles: {
        profileRecord: {
            _id: string;
            username: string;
            firstName: string;
            lastName: string;
            phone: string;
            role: string;
            email: string;
            createdAt: string;
            updatedAt: string;
        };
        totalProfileCount: number;
    };
}
