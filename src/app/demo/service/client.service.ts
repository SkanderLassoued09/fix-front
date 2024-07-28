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
    removeClient(_id: string) {
        return gql`
        mutation {
            removeClient(_id:"${_id}")
        }
    `;
    }

    updateClient(clientData) {
        return gql`
            mutation {
                updateClient(
                    updateClientInput: {
                        _id: "${clientData._id}"
                        first_name: "${clientData.first_name}"
                        last_name: "${clientData.last_name}"
                        region: "${clientData.region}"
                        address: "${clientData.address}"
                        email: "${clientData.email}"
                        phone: "${clientData.phone}"
                    }
                ) {
                    _id
                    first_name
                    last_name
                    region
                    address
                    email
                    phone
                }
            }
        `;
    }
}
