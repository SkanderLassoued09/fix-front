import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MagasinDiListRoutingModule } from './magasin-di-list-routing.module';
import { PaginatorModule } from 'primeng/paginator';

@NgModule({
    declarations: [],
    imports: [CommonModule, MagasinDiListRoutingModule, PaginatorModule],
})
export class MagasinDiListModule {}
