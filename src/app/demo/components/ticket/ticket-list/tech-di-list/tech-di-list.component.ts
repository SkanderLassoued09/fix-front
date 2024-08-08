import { ChangeDetectorRef, Component } from '@angular/core';
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
        pdf: new FormControl(),
    });

    remarque = new FormGroup({
        remarqueRepair: new FormControl(),
    });
    composantTech = {
        name: '',
        package: '',
        link: '',
        category_composant_id: '',
        pdf: '',
    };

    visible: boolean = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;

    uploadedFiles: any[] = [];
    cols = [{ field: '_idDi', header: 'ID' }];
    payloadImage: { image: string };
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
    hasPdr: boolean;
    isReperable: boolean;
    remarque_manager: string;
    remarque_admin_manager: string;
    remarque_admin_tech: string;
    remarque_tech_diagnostic: string;
    remarque_magasin: string;
    remarque_coordinator: string;
    remarqueReparation: any;
    statusFinal: any;
    disable: any;
    imageValue: string;
    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.getAllTechDi();
        this.getComposant();
        this.checkValueChanges();
        this.checkValueChangesReperable();
        console.log('array data,', this.composantList);
        // this.btnConditionReperation();
        // this.btnConditionDiagnostique();
    }

    closeComposantModal() {
        console.log('MODAL CLOSE');
        this.creatComposantDialog = false;
    }
    saveNewComposant() {
        console.log('SAVE COMPOSANT is on ');
        //NEW FILE HERE "pdf"
        const { name, packageComposant, category_composant_id, link, pdf } =
            this.composantTechnicien.value;

        this.apollo
            .mutate<CreateComposantMutationResult>({
                mutation: this.ticketSerice.createComposantByTech(
                    name,
                    packageComposant,
                    category_composant_id,
                    link,
                    pdf
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                console.log('problem inside the mutation ');

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

    getImage() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getImageforDI(this.selectedDi_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    console.log(data.getDiById.image, 'data image');
                    this.imageValue = data.getDiById.image;
                }
            });
    }

    diagModal(di) {
        this.di = { ...di };
        this.selectedDi = di._id;
        this.selectedDi_id = di._idDi;
        this.diDialogDiag = true;
        this.diStatus = di.status;
        this.changeStatus(di._idDi);
        this.getTimeSpent(di._id);
        this.getImage();
    }

    repModal(di) {
        console.log('fired');
        this.di = { ...di };
        this.selectedDi = di._id;
        this.diDialogRep = true;
        this.getTimeSpentRep(di._id);
        this.changeStatusInReparation(di._id);
        this.getAllRemarque(di._idDi);
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

    getAllRemarque(_id) {
        console.log(_id, 'idd');
        console.log('fired');
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllRemarque(_id),
            })
            .subscribe(({ data }) => {
                console.log('remarque', data);
                if (data) {
                    this.remarque_manager =
                        data.getAllRemarque.remarque_manager;
                    this.remarque_admin_manager =
                        data.getAllRemarque.remarque_admin_manager;
                    this.remarque_admin_tech =
                        data.getAllRemarque.remarque_admin_tech;
                    this.remarque_tech_diagnostic =
                        data.getAllRemarque.remarque_tech_diagnostic;
                    this.remarque_magasin =
                        data.getAllRemarque.remarque_magasin;
                    this.remarque_coordinator =
                        data.getAllRemarque.remarque_coordinator;
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
    deleteSelectedProducts(): void {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce composant de la liste',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.composantCombo = this.composantCombo.filter(
                    (val) => !this.selectedComposants.includes(val)
                );
                console.log('🍷[composantCombo]:', this.composantCombo);
                this.selectedComposants = [];
                this.messageService.add({
                    severity: 'success',
                    summary: 'Successful',
                    detail: 'Products Deleted',
                    life: 1000,
                });
            },
        });
    }

    onRowClick(composant: any): void {
        console.log('Selected Composant:', composant);
        // Additional logic for the clicked row can be added here
        const index = this.composantCombo.findIndex((el) => {
            el.nameComposant === composant.nameComposant;
        });
        this.composantCombo.splice(index, 1);
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
        this.isFinishedDiag = true; // Disable the button immediately after it is clicked
        this.lapTimeForPauseAndGetBack();

        const dataDiag = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.value.isPdr,
            reparable: this.diagFormTech.value.isReparable,
            remarqueTech: this.diagFormTech.value.remarqueTech,
            composant: this.composantCombo,
        };

        if (dataDiag.pdr) {
            console.log('🍟[dataDiag.pdr true]:', dataDiag.pdr);
            this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.finish(dataDiag),
                    useMutationLoading: true,
                })
                .subscribe(({ data, loading }) => {
                    console.log('🍤[data]:', data);
                    if (data) {
                        console.log('SENDING TO ESTIMATION WORKING', data);
                        this.disable = data.tech_startDiagnostic;
                        this.cdr.detectChanges();
                        this.changeStatusMagasinEstimation(dataDiag._idDi);
                    }
                });
        } else {
            console.log('🍟[dataDiag.pdr false]:', dataDiag.pdr);
            this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.finish(dataDiag),
                    useMutationLoading: true,
                })
                .subscribe(({ data, loading }) => {
                    if (data) {
                        console.log('🥒[data]:', data);
                        this.disable = data.tech_startDiagnostic;
                        this.cdr.detectChanges();
                        console.log(
                            'SENDING TO ESTIMATION WORKING',
                            this.disable
                        );
                        this.changeStatusToPending2(dataDiag._idDi);
                    }
                });
        }
        this.getAllTechDi();
    }

    changeStatusToPending2(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .subscribe(({ data }) => {
                console.log('🍒[data]:', data);

                this.isFinishedDiag = true;
            });
    }
    confirmComposant() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.responseConfirmerRecoitComposant(
                    this.selectedDi
                ),
            })
            .subscribe(({ data }) => {
                console.log('🍋[data]:', data);
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
                this.getAllTechDi();
            });
    }
    // i stoped here i need to get back when he stops and continue counting when tech click finish froze the butons
    lapTimeForPauseAndGetBack1() {
        // for rep
        this.lap1();
        console.log(this.selectedDi, this.lapTime1);
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

    checkValueChanges() {
        this.diagFormTech.get('isPdr')?.valueChanges.subscribe((value) => {
            console.log('isPdr value changed:', value);
            this.hasPdr = value;
            // Additional logic based on value changes
        });
    }
    checkValueChangesReperable() {
        this.diagFormTech
            .get('isReparable')
            ?.valueChanges.subscribe((value) => {
                console.log('isReperable value changed:', value);
                this.isReperable = value;
                // Additional logic based on value changes
            });
    }

    finishReparation() {
        const req = this.remarque.value.remarqueRepair;
        this.lapTimeForPauseAndGetBack1();
        this.lap1();
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finishReparation(
                    this.DiByStat,
                    req
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data }) => {
                console.log(
                    '🥝[data tech_finishReperation]:',
                    data?.tech_finishReperation?.status
                );
            });
        this.getAllTechDi();
    }

    onUpload(event: any) {
        console.log(event, 'this the event ');

        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;
                this.uploadFile(base64);
            };
        }
    }

    uploadFile(base64: string) {
        const payload = {
            image: base64,
            // add other necessary data here
        };
        console.log('🌮[payload]:', payload);
        this.payloadImage = payload;
        // this.http.post('http://your-backend-url/tickets', payload).subscribe(
        //     (response) => {
        //         console.log('Upload successful', response);
        //     },
        //     (error) => {
        //         console.log('Upload failed', error);
        //     }
        // );
    }
}
