/*
 * Pruebas unitarias
 * Prueba PlayersComponent
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayersComponent } from './players';

describe('PlayersComponent', () => {
  let component: PlayersComponent;
  let fixture: ComponentFixture<PlayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayersComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PlayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading=true', () => {
    expect(component.loading).toBeTruthy();
  });
});
