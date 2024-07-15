import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

@Injectable({
    providedIn: 'root',
})
export class ClientService {
    constructor() {}

    addClient(clientInfo) {
        return gql`
        mutation {
            createClient(
                createClientInput: {
                    first_name: "${clientInfo.first_name}"
                    last_name: "${clientInfo.last_name}"
                    region: "${clientInfo.region}"
                    address: "${clientInfo.address}"
                    email: "${clientInfo.email}"
                    phone: "${clientInfo.phone}"
                }
            ) {
                _id
            }
        }
    `;
    }

    getAllClient(rows, first) {
        return gql`
            {
                findAllClient(PaginationConfig: { rows: ${rows}, first: ${first} }) {
                    clientRecords {
                        _id
                        first_name
                        last_name
                        region
                        address
                        email
                        phone
                    }
                    totalClientRecord
                }
            }
        `;
    }
}
