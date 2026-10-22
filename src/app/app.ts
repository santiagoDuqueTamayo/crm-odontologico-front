import { Component } from '@angular/core';
//import { RouterOutlet } from '@angular/router';
import { OdontogramaViewComponent } from './features/odontograma/odontograma-view/odontograma-view';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ OdontogramaViewComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App { 
  title = 'crm-odontologico';
}