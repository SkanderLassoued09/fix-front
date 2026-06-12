import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

/**
 * Company GraphQL operations — parameterised with typed VARIABLES (not string
 * interpolation). This closes the S10 interpolation-injection risk and lets the
 * backend validate typed inputs. Each method returns a document; the caller
 * passes the matching `variables` to `apollo.mutate/query`.
 */
const COMPANY_FIELDS = `
    _id
    name
    region
    address
    email
    phone
    activitePrincipale
    activiteSecondaire
    raisonSociale
    Exoneration
    fax
    webSiteLink
    mf
    rne
    driveFolderId
    driveFolderUrl
    serviceAchat { name email phone }
    serviceFinancier { name email phone }
    serviceTechnique { name email phone }
`;

@Injectable({
    providedIn: 'root',
})
export class CompanyService {
    constructor() {}

    /** variables: { input: CreateCompanyInput } */
    addCompany() {
        return gql`
            mutation CreateCompany($input: CreateCompanyInput!) {
                createCompany(createCompanyInput: $input) {
                    _id
                }
            }
        `;
    }

    /** variables: { config: PaginationConfig, search: SearchInput } */
    searchCompany() {
        return gql`
            query SearchCompany($config: PaginationConfig!, $search: SearchInput!) {
                searchCompany(paginationConfig: $config, search: $search) {
                    companyRecords {
                        ${COMPANY_FIELDS}
                    }
                    totalCompanyRecord
                }
            }
        `;
    }

    /** variables: { config: PaginationConfig } */
    getAllCompany() {
        return gql`
            query FindAllCompany($config: PaginationConfig!) {
                findAllCompany(PaginationConfig: $config) {
                    companyRecords {
                        ${COMPANY_FIELDS}
                    }
                    totalCompanyRecord
                }
            }
        `;
    }

    /** variables: { id: String } */
    removeCompany() {
        return gql`
            mutation RemoveCompany($id: String!) {
                removeCompany(_id: $id) {
                    _id
                    isDeleted
                }
            }
        `;
    }

    /** variables: { id: String } */
    findOneCompany() {
        return gql`
            query FindOneCompany($id: String!) {
                findOneCompany(_id: $id) {
                    ${COMPANY_FIELDS}
                }
            }
        `;
    }

    /** variables: { input: UpdateCompanyInput } */
    updatecompany() {
        return gql`
            mutation UpdateCompany($input: UpdateCompanyInput!) {
                updateCompany(updateCompanyInput: $input) {
                    ${COMPANY_FIELDS}
                }
            }
        `;
    }
}
