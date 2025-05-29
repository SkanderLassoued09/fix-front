import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MagasinDiListRoutingModule } from './magasin-di-list-routing.module';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        MagasinDiListRoutingModule,
        PaginatorModule,
        InputTextModule,
        DropdownModule,
    ],
})
export class MagasinDiListModule {}
