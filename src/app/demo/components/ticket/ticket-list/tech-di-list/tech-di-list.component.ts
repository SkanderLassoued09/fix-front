import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Product, ProductT } from 'src/app/demo/api/product';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ConfigDiagAffectationMutationResult,
    ConfigRepAffectationMutationResult,
    DiListTechQueryResult,
} from './tech-di-list.interface';
import { CreateComposantMutationResult } from './tech-di-list-interface';

@Component({
    selector: 'app-tech-di-list',
    templateUrl: './tech-di-list.component.html',
    styleUrl: './tech-di-list.component.scss',
})
export class TechDiListComponent {
    selectedComposants: any[] = [];
    diagFormTech = new FormGroup({
        _idDi: new FormControl(),

        diag_time: new FormControl(),
        remarqueTech: new FormControl(''),
        isPdr: new FormControl(false),
        isReparable: new FormControl(false),
        quantity: new FormControl(0),
        composantSelectedDropdown: new FormControl(),
    });

    composantTechnicien = new FormGroup({
        _idComposant: new FormControl(),
        name: new FormControl(),
        packageComposant: new FormControl(),
        category_composant_id: new FormControl(),
        link: new FormControl(),
    });

    composantTech = {
        name: '',
        package: '',
        link: '',
        category_composant_id: '',
    };

    visible: boolean = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;

    uploadedFiles: any[] = [];
    cols = [{ field: '_idDi', header: 'ID' }];

    countries;
    selectedCountry;
    diList: any;
    diListCount: any;
    diDialog: boolean = false;
    di: any;
    techList: any;
    selectedDi: any;
    isRunning: any;
    startTime: number;
    minutes: string;
    seconds: string;
    milliseconds: string;
    lapTime: string;
    laps: any[];
    diDialogDiag: boolean;
    diDialogRep: boolean;
    composant: any;
    addComposantLoading: boolean;
    composantList: Array<any> = [];
    composantSelected: any;
    composantCombo: Array<{ nameComposant: string; quantity: number }> = [];
    selectedDi_id: any;
    initialOffset: number;
    isFinishedDiag: boolean = false;

    milliseconds1: string;
    seconds1: string;
    minutes1: string;
    lapTime1: string;
    isRunning1: boolean;
    startTime1: number;
    laps1: any[];
    remarqueReparation: any;
    formGroupchips: any;
    chipsValues: string[] = [];
    submitted: boolean = false;
    composantDialog: boolean = false;
    creatComposantDialog: any;
    product: {};
    diStatus: any;
    // FOR THE CONDITION OF THE BTN
    diagnostiquefinishedFLAG: boolean = true;
    reperationfinishedFLAG: boolean = true;
    DiByStat: any;
    loadingCreatingComposant: boolean;
    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.getAllTechDi();
        this.getComposant();
        console.log('array data,', this.composantList);
        // this.btnConditionReperation();
        // this.btnConditionDiagnostique();
    }
    //!Modal creation of new composant start here

    closeComposantModal() {
        console.log('MODAL CLOSE');
        this.creatComposantDialog = false;
    }
    saveNewComposant() {
        console.log('SAVE COMPOSANT is on ');

        const {
            _idComposant,
            name,
            packageComposant,
            category_composant_id,
            link,
        } = this.composantTechnicien.value;

        this.apollo
            .mutate<CreateComposantMutationResult>({
                mutation: this.ticketSerice.createComposantByTech(
                    name,
                    packageComposant,
                    category_composant_id,
                    link
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                this.loadingCreatingComposant = loading;

                if (data) {
                    console.log('data creating composant', data);
                    this.getComposant();
                    this.composantTechnicien.reset();
                    this.creatComposantDialog = false;
                }
            });
    }
    selctedDropDownComposantTech() {
        console.log('drop down tech');
    }
    //! end here

    showDialog() {
        this.visible = true;
    }
    //Todo when you query the data add the status of the DI so we can use it for the Btn's condition
    getAllTechDi() {
        this.apollo
            .watchQuery<DiListTechQueryResult>({
                query: this.ticketSerice.diListTech(),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.techList = data.getDiForTech;
                    console.log('this.techList VALUE', this.techList);
                }
            });
    }
    load() {
        this.loading = true;
        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    diagModal(di) {
        this.di = { ...di };
        this.selectedDi = di._id;
        this.selectedDi_id = di._idDi;
        this.diDialogDiag = true;
        this.diStatus = di.status;
        this.changeStatus(di._idDi);
        this.getTimeSpent(di._id);
    }
    //!!Nezih
    repModal(di) {
        this.di = { ...di };
        this.selectedDi = di._id;
        this.diDialogRep = true;
        this.getTimeSpentRep(di._id);
        this.changeStatusInReparation(di._id);
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatbyID(this.selectedDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    console.log(data.getStatbyID._idDi, 'data');
                    this.DiByStat = data.getStatbyID._idDi;
                }
            });
    }

    hideDialogDiag() {
        this.diDialogDiag = false;
    }
    hideDialogRep() {
        this.diDialogRep = false;
    }
    //! GET THE STATUS from the DI
    // btnConditionDiagnostique() {
    //     console.log(this.selectedDi, 'this.diagnostiquefinishedFLAG');

    //     if (
    //         this.diStatus === 'DIAGNOSTIC' ||
    //         this.diStatus === 'INDIAGNOSTIC'
    //     ) {
    //         this.diagnostiquefinishedFLAG = false;
    //         console.log(
    //             this.diagnostiquefinishedFLAG,
    //             'this.diagnostiquefinishedFLAG'
    //         );
    //     }
    // }
    btnConditionReperation() {
        console.log(this.reperationfinishedFLAG, 'this.reperationfinishedFLAG');

        if (
            this.diStatus === 'REPARATION' ||
            this.diStatus === 'INREPARATION'
        ) {
            this.reperationfinishedFLAG = false;
            console.log(
                this.reperationfinishedFLAG,
                'this.reperationfinishedFLAG'
            );
        }
    }

    selectedTechDiag(data) {
        this.apollo
            .mutate<ConfigDiagAffectationMutationResult>({
                mutation: this.ticketSerice.configDiagAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {});
    }
    selectedTechRep(data) {
        this.apollo
            .mutate<ConfigRepAffectationMutationResult>({
                mutation: this.ticketSerice.configRepAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {});
    }

    changeStatus(_id) {
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusDiToInDiagnostique(_id),
            })
            .subscribe(({ data, loading }) => {
                console.log('🍰[data]:', data);
            });
    }

    changeStatusInReparation(_id) {
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusInRepair(_id),
            })
            .subscribe(({ data, loading }) => {
                console.log('changeStatusInReparation [data]:', data);
            });
    }

    // handling stopwatch
    /**
     * --------------------------
     */

    startStopwatch() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.startTime = Date.now() - this.initialOffset;
            this.updateTimer();
        } else {
            this.isRunning = false;
        }
    }
    startStopwatch1() {
        if (!this.isRunning1) {
            console.log('startStopwatch1');

            this.isRunning1 = true;
            this.startTime1 = Date.now() - this.initialOffset;
            this.updateTimer1();
        } else {
            this.isRunning1 = false;
        }
    }

    updateTimer() {
        if (this.isRunning) {
            const elapsedTime = Date.now() - this.startTime;
            this.minutes = this.padZero(
                Math.floor(elapsedTime / (1000 * 60 * 60))
            );
            this.seconds = this.padZero(
                Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60))
            );
            this.milliseconds = this.padZero(
                Math.floor((elapsedTime % (1000 * 60)) / 1000)
            );

            requestAnimationFrame(() => this.updateTimer());
        }
    }
    updateTimer1() {
        if (this.isRunning1) {
            const elapsedTime = Date.now() - this.startTime1;
            this.minutes1 = this.padZero(
                Math.floor(elapsedTime / (1000 * 60 * 60))
            );
            this.seconds1 = this.padZero(
                Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60))
            );
            this.milliseconds1 = this.padZero(
                Math.floor((elapsedTime % (1000 * 60)) / 1000)
            );

            requestAnimationFrame(() => this.updateTimer1());
        }
    }

    lap() {
        if (this.isRunning) {
            this.lapTime = ` ${this.minutes}:${this.seconds}:${this.milliseconds}`;
        }
    }

    lap1() {
        if (this.isRunning1) {
            this.lapTime1 = ` ${this.minutes1}:${this.seconds1}:${this.milliseconds1}`;
        }
    }

    reset() {
        this.minutes = '00';
        this.seconds = '00';
        this.milliseconds = '00';
        this.isRunning = false;
        this.startTime = 0;
        this.initialOffset = 0;
        this.startTime1 = 0;
        this.laps = [];
    }
    reset1() {
        this.minutes1 = '00';
        this.seconds1 = '00';
        this.milliseconds1 = '00';
        this.isRunning1 = false;
        this.startTime1 = 0;
        this.startTime1 = 0;
        this.laps1 = [];
    }

    padZero(value: number): string {
        return value.toString().padStart(2, '0');
    }

    setInitialTime(timeString: string) {
        console.log('🍜[timeString]:', timeString);
        const [minutes, seconds, milliseconds] = timeString
            .split(':')
            .map(Number);
        this.initialOffset =
            minutes * 60 * 60 * 1000 +
            seconds * 60 * 1000 +
            milliseconds * 1000;
        this.minutes = this.padZero(minutes);
        this.seconds = this.padZero(seconds);
        this.milliseconds = this.padZero(milliseconds);
    }
    setInitialTime1(timeString: string) {
        console.log('🍜[timeString]:', timeString);
        const [minutes, seconds, milliseconds] = timeString
            .split(':')
            .map(Number);
        this.initialOffset =
            minutes * 60 * 60 * 1000 +
            seconds * 60 * 1000 +
            milliseconds * 1000;
        this.minutes1 = this.padZero(minutes);
        this.seconds1 = this.padZero(seconds);
        this.milliseconds1 = this.padZero(milliseconds);
    }
    // ------------
    getComposant() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getAllComposant(),
            })
            .valueChanges.subscribe(({ data }) => {
                if (data) {
                    this.composantList = data.findAllComposant;
                }
            });
    }
    //!!!!!!!!! open modal for composant creation
    openNew() {
        console.log('OPEN MODAL');
        this.creatComposantDialog = true;
    }
    deleteSelectedProducts() {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce composant de la liste',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.composantCombo = this.composantCombo.filter(
                    (val) => !this.composant?.includes(val)
                );
                this.composant = null;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Successful',
                    detail: 'Products Deleted',
                    life: 1000,
                });
            },
        });
    }
    createComposant() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.createComposant(this.composant),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.addComposantLoading = loading;
                if (data) {
                    let com = {
                        _id: data.createComposant._id,
                        name: data.createComposant.name,
                    };
                    this.composantList.push(com);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: `Le composant ${data.createComposant.name} ajouté avec succes`,
                    });
                }
            });
    }

    /**
     * This function will get the lap time and save it in stats entity
     * will get the lap as pause time save it only he can back to this ticket again and make the counter start again on the last time saved and continue incrementing
     *!When user click on finish diag and status changed the button would be frozen!
     */

    lapTimeForPauseAndGetBack() {
        // for diag
        this.lap();
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.lapTimeForPauseAndGetBack(
                    this.selectedDi,
                    this.lapTime
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diDialogDiag = false;
                }
            });

        this.startStopwatch();
    }

    selectedDropDown(selectedItem) {
        this.composantSelected = selectedItem;
    }
    getSeverity(status: string) {
        console.log('🍛DI => [status]:', status);
        switch (status) {
            case 'CREATED':
                return 'success';
            case 'PENDING1':
            case 'PENDING2':
            case 'PENDING3':
                return 'help';
            case 'DIAGNOSTIC':
            case 'INDIAGNOSTIC':
                return 'info';
            case 'INMAGASIN':
            case 'MagasinEstimation':
                return 'warning';
            case 'PRICING':
                return 'warning';
            case 'NEGOTIATION1':
            case 'NEGOTIATION2':
                return 'warning';
            case 'REPARATION':
            case 'INREPARATION':
                return 'info';
            case 'FINISHED':
                return 'success';
            case 'ANNULER':
                return 'contrast';
            case 'RETOUR1':
            case 'RETOUR2':
            case 'RETOUR3':
                return 'danger';
            default:
                return 'warn';
        }
    }
    comboComposantandQuantity() {
        let composantSelected = {
            nameComposant: this.composantSelected.value.name,
            quantity: this.diagFormTech.value.quantity,
        };

        console.log('🥚', this.selectedComposants);

        this.composantCombo.push(composantSelected);
    }

    changeStatusMagasinEstimation(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusMagasinEstimation(_id),
            })
            .subscribe(({ data, loading }) => {
                this.isFinishedDiag = true;
            });
    }
    //!Tech finishing Diagnostique here
    techFinishDiag() {
        this.lapTimeForPauseAndGetBack();

        const dataDiag = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.value.isPdr,
            reparable: this.diagFormTech.value.isReparable,
            remarqueTech: this.diagFormTech.value.remarqueTech,
            composant: this.composantCombo,
        };

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finish(dataDiag),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                if (data) {
                    console.log('SENDING TO ESTIMATION WORKING');

                    this.changeStatusMagasinEstimation(dataDiag._idDi);
                }
            });
    }

    // this function to get the time spênt oif this ticket will be called in opening modal function
    getTimeSpent(_idStat: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getLastPauseTime(_idStat),
            })
            .valueChanges.subscribe(({ data }) => {
                console.log('🥚[data]:', data);

                if (
                    data &&
                    data.getLastPauseTime.diag_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.diag_time)
                ) {
                    this.setInitialTime(data.getLastPauseTime.diag_time);
                    this.startStopwatch();
                } else {
                    this.setInitialTime('00:00:00');
                    this.startStopwatch();
                }
            });
    }
    //! WORKING HERE
    getTimeSpentRep(_idStat: string) {
        this.apollo

            .query<any>({
                query: this.ticketSerice.getLastPauseTime(_idStat),
            })
            .subscribe(({ data }) => {
                console.log('🥚[data  getTimeSpentRep]:', data);

                if (
                    data &&
                    data.getLastPauseTime.rep_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.rep_time)
                ) {
                    console.log('correct condition');

                    this.setInitialTime1(data.getLastPauseTime.rep_time);
                    this.startStopwatch1();
                } else {
                    console.log('incorrect condition');

                    this.setInitialTime('00:00:00');
                    this.startStopwatch1();
                }
            });
    }

    isValidTimeFormat(timeString: string): boolean {
        console.log('🥠[timeString]:', timeString);
        if (!timeString) {
            return false;
        }
        const trimmedTimeString = timeString.trim();
        const regex = /^\d{2}:\d{2}:\d{2}$/;
        const is = regex.test(trimmedTimeString);
        console.log(
            '🥔[is valid]:',
            is,
            '🥠[trimmedTimeString]:',
            trimmedTimeString
        );
        return is;
    }
    techFinishDiag1() {
        // this.lapTimeForPauseAndGetBack1();

        const dataDiag = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.value.isPdr,
            reparable: this.diagFormTech.value.isReparable,
            remarqueTech: this.diagFormTech.value.remarqueTech,
            composant: this.composantCombo,
        };
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finish(dataDiag),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                console.log('🎂[loading]:', loading);
                console.log('🥝[data]:', data);
                if (data) {
                    this.changeStatusMagasinEstimation(dataDiag._idDi);
                }
            });
    }
    // i stoped here i need to get back when he stops and continue counting when tech click finish froze the butons
    lapTimeForPauseAndGetBack1() {
        // for rep
        this.lap1();
        console.log(
            this.selectedDi,
            this.lapTime1,
            'oivqùprj,vùpid,rvùbosien,dwùn,'
        );
        this.apollo
            .mutate<any>({
                mutation:
                    this.ticketSerice.lapTimeForPauseAndGetBackForReaparation(
                        this.selectedDi,
                        this.lapTime1
                    ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diDialogRep = false;
                }
            });

        this.startStopwatch1();
    }
    //! NEZIH
    finishReparation() {
        console.log(this.remarqueReparation, ' this.remarqueReparation');

        this.lap1();
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finishReparation(
                    this.DiByStat,
                    this.remarqueReparation
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diDialogRep = false;
                }
            });
    }
}
