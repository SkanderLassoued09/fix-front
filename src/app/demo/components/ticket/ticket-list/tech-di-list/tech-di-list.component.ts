import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { MessageService } from 'primeng/api';
import { Product } from 'src/app/demo/api/product';
import { TicketService } from 'src/app/demo/service/ticket.service';

@Component({
    selector: 'app-tech-di-list',

    templateUrl: './tech-di-list.component.html',
    styleUrl: './tech-di-list.component.scss',
})
export class TechDiListComponent {
    diagFormTech = new FormGroup({
        _idDi: new FormControl(),

        diag_time: new FormControl(),
        remarqueTech: new FormControl(),
        isPdr: new FormControl(),
        isReparable: new FormControl(),
        quantity: new FormControl(),
        composantSelectedDropdown: new FormControl(),
    });

    visible: boolean = false;
    products!: Product[];
    values: string[] | undefined;

    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;

    uploadedFiles: any[] = [];
    cols = [
        { field: '_id', header: 'ID' },
        { field: '_idDi', header: 'Di sous intervention' },
    ];

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

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.getAllTechDi();
        this.getComposant();
    }

    showDialog() {
        this.visible = true;
    }

    getAllTechDi() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.diListTech(),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                console.log('🍤[data]:', data);
                if (data) {
                    this.techList = data.getDiForTech;
                    console.log('🍍[this.techList]:', this.techList);
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
        console.log('🥘[di]:', this.di);
        this.selectedDi = di._id;
        this.selectedDi_id = di._idDi;
        this.diDialogDiag = true;
        this.startStopwatch();
    }
    repModal(di) {
        this.di = { ...di };
        console.log('🥘[di]:', this.di);
        this.selectedDi = di._id;
        this.diDialogRep = true;
    }

    hideDialogDiag() {
        this.diDialogDiag = false;
    }
    hideDialogRep() {
        this.diDialogRep = false;
    }

    selectedTechDiag(data) {
        console.log('🥒'), this.selectedDi, data.value._id;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.configDiagAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                console.log('🥘[errors]:', errors);
                console.log('🍝[loading]:', loading);
                console.log('🧀[data]:', data);
            });
    }
    selectedTechRep(data) {
        console.log('🥒'), this.selectedDi, data.value._id;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.configRepAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                console.log('🥘[errors]:', errors);
                console.log('🍝[loading]:', loading);
                console.log('🧀[data]:', data);
            });
    }

    // handling stopwatch
    /**
     * --------------------------
     */

    startStopwatch() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.startTime = Date.now();
            this.updateTimer();
        } else {
            this.isRunning = false;
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

    lap() {
        if (this.isRunning) {
            this.lapTime = ` ${this.minutes}:${this.seconds}:${this.milliseconds}`;
            console.log(this.lapTime, 'laptime');
        }
    }

    reset() {
        this.minutes = '00';
        this.seconds = '00';
        this.milliseconds = '00';
        this.isRunning = false;
        this.startTime = 0;
        this.laps = [];
    }

    padZero(value: number): string {
        return value.toString().padStart(2, '0');
    }

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

    createComposant() {
        console.log('🌽[this.composant]:', this.composant);
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.createComposant(this.composant),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.addComposantLoading = loading;
                if (data) {
                    console.log('🧀[data]:', data);

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
                console.log('🍭[errors]:', errors);
                console.log('🥖[loading]:', loading);
                console.log('🥓[data]:', data);
                if (data) {
                    this.diDialogDiag = false;
                }
            });
    }
    selectedDropDown(selectedItem) {
        console.log('🍼️[selectedItem]:', selectedItem);
        this.composantSelected = selectedItem;
    }

    comboComposantandQuantity() {
        let composantSelected = {
            nameComposant: this.composantSelected.value.name,
            quantity: this.diagFormTech.value.quantity,
        };
        console.log('🍺[composantSelected]:', composantSelected);
        this.composantCombo.push(composantSelected);
    }

    techFinishDiag() {
        this.lapTimeForPauseAndGetBack();

        const dataDiag = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.value.isPdr,
            reparable: this.diagFormTech.value.isReparable,
            remarqueTech: this.diagFormTech.value.remarqueTech,
            composant: this.composantCombo,
        };
        console.log('🥤', dataDiag);
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finish(dataDiag),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                console.log('🍉[loading]:', loading);
                console.log('🥟[data]:', data);
            });
    }
}
