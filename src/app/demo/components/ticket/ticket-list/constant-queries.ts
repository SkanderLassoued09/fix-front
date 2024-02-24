import { gql } from 'apollo-angular';

export const ALL_USERS = gql`
    {
        findAll {
            _id
            name
            age
            breed
        }
    }
`;

export type COLUMNS = {
    field: string;
    header: string;
};
