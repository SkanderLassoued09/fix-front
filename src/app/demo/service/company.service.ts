import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

@Injectable({
    providedIn: 'root',
})
export class CompanyService {
    constructor() {}

    addCompany(companyInfo) {
        return gql`
            mutation {
                createCompany(
                    createCompanyInput: {
                        name: "${companyInfo.companyName}"
                        region: "${companyInfo.region}"
                        address: "${companyInfo.address}"
                        email: "${companyInfo.email}"
                        raisonSociale: "${companyInfo.raisonSociale}"
                        Exoneration: "${companyInfo.Exoneration}"
                        fax: "${companyInfo.fax}"
                        webSiteLink: "${companyInfo.website}"
                        activitePrincipale: "${companyInfo.activitePrincipale}"
                        activiteSecondaire: "${companyInfo.activiteSecondaire}"
                        serviceAchat: { name: "${companyInfo.achat.fullName}", email: "${companyInfo.achat.email}", phone: "${companyInfo.achat.phone}" }
                        serviceTechnique: { name: "${companyInfo.technique.fullName}", email: "${companyInfo.technique.email}", phone: "${companyInfo.technique.phone}" }
                        serviceFinancier: { name: "${companyInfo.financier.fullName}", email: "${companyInfo.financier.email}", phone: "${companyInfo.financier.phone}" }
                    }
                ) {
                    _id
                }
            }
        `;
    }

    getAllCompany(first, row) {
        return gql`
            {
                findAllCompany(PaginationConfig: { rows: ${row}, first: ${first} }) {
                    companyRecords {
                        _id
                        name
                        region
                        address
                        email
                        activitePrincipale
                        activitePrincipale
                        activiteSecondaire
                        raisonSociale
                        Exoneration
                        fax
                        webSiteLink
                        serviceAchat {
                            name
                            email
                            phone
                        }
                        serviceFinancier {
                            name
                            email
                            phone
                        }
                        serviceTechnique {
                            name
                            email
                            phone
                        }
                    }
                    totalCompanyRecord
                }
            }
        `;
    }

    removeCompany(_id: string) {
        return gql`
        mutation {
            removeCompany(_id:"${_id}")
        }
    `;
    }

    findOneCompany(_id: string) {
        return gql`
        query {
            findOneCompany(_id: "${_id}") {
                _id
                name
                region
                address
                email
                activitePrincipale
                activitePrincipale
                activiteSecondaire
                raisonSociale
                Exoneration
                fax
                webSiteLink
                serviceAchat {
                    name
                    email
                    phone
                }
                serviceFinancier {
                    name
                    email
                    phone
                }
                serviceTechnique {
                    name
                    email
                    phone
                }
            }
        }
    `;
    }

    /**
     * Update company
     */

    updatecompany(company: any) {
        return gql`
            mutation {
                updateCompany(
                    updateCompanyInput: {
                        _id: "${company._id}"
                        name: "${company.name}"
                        region: "${company.region}"
                        address: "${company.address}"
                        email: "${company.email}"
                        Exoneration: "${company.Exoneration}"
                        raisonSociale: "${company.raisonSociale}"
                        fax: "${company.fax}"
                        webSiteLink: "${company.webSiteLink}"
                    }
                ) {
                    _id
                    name
                    region
                    address
                    email
                    raisonSociale
                    Exoneration
                    fax
                    webSiteLink
                }
            }
        `;
    }
}
