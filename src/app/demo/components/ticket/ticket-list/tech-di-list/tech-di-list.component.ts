import { Component } from '@angular/core';
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

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService
    ) {
        // this.roles = ROLES;
    }

    ngOnInit() {
        // this.getDi();

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

    // onUpload(event: UploadEvent) {
    //     for (let file of event.files) {
    //         this.uploadedFiles.push(file);
    //     }
    // }

    diagModal(di) {
        this.di = { ...di };
        console.log('🥘[di]:', this.di);
        this.selectedDi = di._id;
        this.diDialogDiag = true;
    }
    repModal(di) {
        this.di = { ...di };
        console.log('🥘[di]:', this.di);
        this.selectedDi = di._id;
        this.diDialogRep = true;
    }

    getSeverity(status: string) {
        // console.log('🦀[status]:', status);
        switch (status) {
            case 'PENDING3':
                return 'success';
            case 'LOWSTOCK':
                return 'warning';
            case 'OUTOFSTOCK':
                return 'danger';
            default:
                return 'warn';
        }
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

    composantSelected(composantSelected) {
        console.log('🍨[composantSelected]:', composantSelected);
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
}
