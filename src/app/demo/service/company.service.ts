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
}
