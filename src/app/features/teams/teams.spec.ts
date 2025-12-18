/*
 * Pruebas unitarias
 * Prueba TeamsComponent
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamsComponent } from './teams';
import { SportDbService } from '../../services/sportdb.service';
import { of } from 'rxjs';

describe('TeamsComponent', () => {
  let component: TeamsComponent;
  let fixture: ComponentFixture<TeamsComponent>;

  const sportServiceMock = {
    getStandings: () => of([]) 
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamsComponent],
      providers: [
        { provide: SportDbService, useValue: sportServiceMock }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TeamsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
