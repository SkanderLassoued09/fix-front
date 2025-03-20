import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MagasinDiListRoutingModule } from './magasin-di-list-routing.module';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
@NgModule({
    declarations: [],
    imports: [CommonModule, MagasinDiListRoutingModule, PaginatorModule,InputTextModule],
})
export class MagasinDiListModule {}
